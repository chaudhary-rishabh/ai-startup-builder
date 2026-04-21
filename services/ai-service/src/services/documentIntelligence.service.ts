import Anthropic from '@anthropic-ai/sdk'
import { getEncoding } from 'js-tiktoken'

import { env } from '../config/env.js'
import { selectModelForContextGeneration } from './modelRouter.service.js'
import { retrieveForAgent } from './contextualRag.service.js'

import type { ProjectContext } from '@repo/types'

const CONTEXTUAL_RAG_TOTAL_THRESHOLD = 200_000

export interface UserDocument {
  docId: string
  filename: string
  text: string
  tokenCount: number
}

export interface DocumentIntelligenceResult {
  mode: 'direct' | 'compressed' | 'contextual_rag' | 'none'
  content: string
  tokenCount: number
  docCount: number
  wasCompressed: boolean
  ragUsed: boolean
}

const enc = getEncoding('cl100k_base')

function estimateTokens(text: string): number {
  return enc.encode(text).length
}

export async function fetchUserDocuments(
  userId: string,
  projectId: string,
): Promise<UserDocument[]> {
  const base = env.RAG_SERVICE_URL.replace(/\/$/, '')
  try {
    const listRes = await fetch(
      `${base}/rag/documents?userId=${encodeURIComponent(userId)}&projectId=${encodeURIComponent(projectId)}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!listRes.ok) return []
    const listJson = (await listRes.json()) as { documents?: { id: string; filename: string }[] }
    const docs = listJson.documents ?? []
    const out: UserDocument[] = []
    for (const d of docs) {
      const textRes = await fetch(`${base}/rag/documents/${encodeURIComponent(d.id)}/text`, {
        signal: AbortSignal.timeout(15_000),
      })
      if (!textRes.ok) continue
      const textJson = (await textRes.json()) as { text?: string }
      const text = textJson.text ?? ''
      out.push({
        docId: d.id,
        filename: d.filename,
        text,
        tokenCount: estimateTokens(text),
      })
    }
    return out
  } catch {
    return []
  }
}

export function formatDocumentBlock(
  docs: UserDocument[],
  mode: 'direct' | 'compressed',
): string {
  const parts = docs.map((d) => {
    const label = mode === 'compressed' ? `[COMPRESSED] ${d.filename}` : d.filename
    return `[Document: ${label}]\n${d.text}\n`
  })
  return parts.join('\n---\n')
}

export async function contextualCompress(doc: UserDocument, agentTask: string): Promise<string> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const model = selectModelForContextGeneration()
  const msg = await client.messages.create({
    model,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: `<document>\n${doc.text}\n</document>`,
        cache_control: { type: 'ephemeral' },
      } as never,
    ],
    messages: [
      {
        role: 'user',
        content: `Given this full document, extract ONLY the sections relevant to this agent task: ${agentTask}.
Return the most relevant 2000-3000 tokens of content.
Preserve exact numbers, names, and specific data.
Omit general background and irrelevant sections.`,
      },
    ],
  })
  const text = msg.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
  return text
}

export async function resolveDocumentContext(
  userId: string,
  projectId: string,
  agentTask: string,
  _agentType: string,
): Promise<DocumentIntelligenceResult> {
  const docs = await fetchUserDocuments(userId, projectId)
  if (docs.length === 0) {
    return {
      mode: 'none',
      content: '',
      tokenCount: 0,
      docCount: 0,
      wasCompressed: false,
      ragUsed: false,
    }
  }

  const totalTokens = docs.reduce((s, d) => s + d.tokenCount, 0)

  if (totalTokens <= env.DOC_DIRECT_INJECT_MAX_TOKENS) {
    const block = formatDocumentBlock(docs, 'direct')
    const wrapped = `<user_documents>\n${block}\n</user_documents>`
    return {
      mode: 'direct',
      content: wrapped,
      tokenCount: estimateTokens(wrapped),
      docCount: docs.length,
      wasCompressed: false,
      ragUsed: false,
    }
  }

  if (totalTokens <= CONTEXTUAL_RAG_TOTAL_THRESHOLD) {
    const compressed: UserDocument[] = []
    for (const d of docs) {
      const excerpt = await contextualCompress(d, agentTask)
      compressed.push({
        docId: d.docId,
        filename: d.filename,
        text: excerpt,
        tokenCount: estimateTokens(excerpt),
      })
    }
    const block = formatDocumentBlock(compressed, 'compressed')
    const wrapped = `<user_documents>\n${block}\n</user_documents>`
    return {
      mode: 'compressed',
      content: wrapped,
      tokenCount: estimateTokens(wrapped),
      docCount: docs.length,
      wasCompressed: true,
      ragUsed: false,
    }
  }

  const rag = await retrieveForAgent(userId, agentTask, {
    projectId,
    projectName: '',
    currentPhase: 1,
  } as ProjectContext)
  const formatted = rag.promptText
  return {
    mode: 'contextual_rag',
    content: formatted,
    tokenCount: estimateTokens(formatted),
    docCount: docs.length,
    wasCompressed: false,
    ragUsed: true,
  }
}
