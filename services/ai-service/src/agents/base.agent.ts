import Anthropic from '@anthropic-ai/sdk'

import { env } from '../config/env.js'
import { estimateCost, getMaxOutputTokens, selectModel } from '../services/modelRouter.service.js'

import type { AgentModel, AgentType, ProjectContext } from '@repo/types'

export interface AgentExecutionInput {
  projectId: string
  userId: string
  phase: number
  userMessage?: string
  context: ProjectContext
  documentContent: string
  docInjectionMode: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  runId: string
  requestId?: string
}

export interface AgentRunResult {
  outputData: Record<string, unknown>
  rawText: string
  parseSuccess: boolean
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: string
}

export abstract class BaseAgent {
  abstract readonly agentType: AgentType
  abstract readonly phase: number
  protected readonly client: Anthropic
  private _model: AgentModel | undefined

  constructor() {
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  }

  protected get model(): AgentModel {
    if (!this._model) {
      this._model = selectModel(this.agentType)
    }
    return this._model
  }

  abstract buildSystemPrompt(context: ProjectContext, documentContent: string): string

  abstract parseOutput(rawText: string): { data: Record<string, unknown>; success: boolean }

  abstract getAgentTask(): string

  protected safeJsonParse(text: string): { data: Record<string, unknown> | null; success: boolean } {
    const tryParse = (s: string) => {
      try {
        return { data: JSON.parse(s) as Record<string, unknown>, success: true as const }
      } catch {
        return null
      }
    }
    const direct = tryParse(text.trim())
    if (direct) return direct

    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
    if (fence?.[1]) {
      const inner = tryParse(fence[1].trim())
      if (inner) return inner
    }

    const startObj = text.indexOf('{')
    const startArr = text.indexOf('[')
    const start =
      startObj === -1 ? startArr : startArr === -1 ? startObj : Math.min(startObj, startArr)
    if (start >= 0) {
      const slice = text.slice(start)
      const endObj = slice.lastIndexOf('}')
      const endArr = slice.lastIndexOf(']')
      const end = Math.max(endObj, endArr)
      if (end > 0) {
        const sub = slice.slice(0, end + 1)
        const j = tryParse(sub)
        if (j) return j
      }
    }
    return { data: null, success: false }
  }

  async run(
    input: AgentExecutionInput,
    onChunk: (chunk: string) => void,
    onProgress?: (event: string) => void,
  ): Promise<AgentRunResult> {
    onProgress?.('build_prompt')
    const system = this.buildSystemPrompt(input.context, input.documentContent)
    const history = input.conversationHistory.slice(-10)
    const userContent = input.userMessage?.trim().length
      ? input.userMessage!
      : 'Produce the structured output for this phase as JSON.'
    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
    ]

    let rawText = ''
    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: getMaxOutputTokens(this.agentType),
      system,
      messages,
    })
    try {
      for await (const ev of stream) {
        if (
          ev.type === 'content_block_delta' &&
          ev.delta.type === 'text_delta' &&
          'text' in ev.delta
        ) {
          const piece = ev.delta.text
          rawText += piece
          onChunk(piece)
        }
      }
    } catch (err) {
      const parsed = this.parseOutput(rawText)
      if (parsed.success && rawText.trim().length > 0) {
        return {
          outputData: parsed.data ?? {},
          rawText,
          parseSuccess: true,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: '0',
        }
      }
      throw err
    }

    const final = await stream.finalMessage()
    const usage = final.usage
    const promptTokens = usage?.input_tokens ?? 0
    const completionTokens = usage?.output_tokens ?? 0
    const totalTokens = promptTokens + completionTokens
    const parsed = this.parseOutput(rawText)
    const costUsd = estimateCost(this.model, promptTokens, completionTokens)
    return {
      outputData: parsed.data ?? {},
      rawText,
      parseSuccess: parsed.success,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
    }
  }
}
