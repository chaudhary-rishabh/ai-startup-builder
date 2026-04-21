import Anthropic from '@anthropic-ai/sdk'

import type { ProjectContext } from '@repo/types'

import { env } from '../config/env.js'

export interface DocDefinition {
  docNumber: number
  name: string
  path: string
  phase: number
}

export const DOC_DEFINITIONS: DocDefinition[] = [
  { docNumber: 1, name: 'Validation Report', path: '/docs/01-validation-report.md', phase: 1 },
  { docNumber: 2, name: 'Product Requirements Document', path: '/docs/02-prd.md', phase: 2 },
  { docNumber: 3, name: 'User Flow', path: '/docs/03-user-flow.md', phase: 2 },
  { docNumber: 4, name: 'Technical Architecture', path: '/docs/04-tech-architecture.md', phase: 2 },
  { docNumber: 5, name: 'UI/UX Specification', path: '/docs/05-uiux-spec.md', phase: 2 },
  { docNumber: 6, name: 'Design Handoff', path: '/docs/06-design-handoff.md', phase: 3 },
  { docNumber: 9, name: 'Test Plan', path: '/docs/09-test-plan.md', phase: 5 },
  { docNumber: 10, name: 'Deployment Guide', path: '/docs/10-deployment-guide.md', phase: 5 },
  { docNumber: 11, name: 'GTM Strategy', path: '/docs/11-gtm-strategy.md', phase: 6 },
  { docNumber: 12, name: 'Analytics Setup Guide', path: '/docs/12-analytics-setup.md', phase: 6 },
]

function projectServiceBase(): string {
  return env.PROJECT_SERVICE_URL.replace(/\/$/, '')
}

export function getRelevantOutput(
  doc: DocDefinition,
  context: ProjectContext,
): Record<string, unknown> {
  switch (doc.docNumber) {
    case 1:
      return (context.phase1Output ?? {}) as unknown as Record<string, unknown>
    case 2: {
      const p2 = context.phase2Output as Record<string, unknown> | undefined
      const prd = p2?.['prd']
      if (prd && typeof prd === 'object' && !Array.isArray(prd)) return prd as Record<string, unknown>
      return { features: p2?.['features'] }
    }
    case 3: {
      const p2 = context.phase2Output as Record<string, unknown> | undefined
      const flow = p2?.['userFlow']
      if (flow && typeof flow === 'object' && !Array.isArray(flow)) return flow as Record<string, unknown>
      return { steps: p2?.['steps'] }
    }
    case 4: {
      const p2 = context.phase2Output as Record<string, unknown> | undefined
      const sd = p2?.['systemDesign']
      if (sd && typeof sd === 'object' && !Array.isArray(sd)) return sd as Record<string, unknown>
      return {
        frontendStack: p2?.['frontendStack'],
        backendStack: p2?.['backendStack'],
        dbChoice: p2?.['dbChoice'],
        architecture: p2?.['architecture'],
        apiEndpoints: p2?.['apiEndpoints'],
      }
    }
    case 5: {
      const p2 = context.phase2Output as Record<string, unknown> | undefined
      const uiux = p2?.['uiux']
      const base =
        uiux && typeof uiux === 'object' && !Array.isArray(uiux)
          ? ({ ...(uiux as Record<string, unknown>) } as Record<string, unknown>)
          : { ...((p2 ?? {}) as Record<string, unknown>) }
      const screens = base['screens']
      if (Array.isArray(screens)) {
        base['screens'] = screens.map((s) => {
          if (!s || typeof s !== 'object' || Array.isArray(s)) return s
          const o = { ...(s as Record<string, unknown>) }
          delete o['html']
          return o
        })
      }
      return base
    }
    case 6: {
      const p3 = context.phase3Output as Record<string, unknown> | undefined
      const screensRaw = p3?.['screens']
      const screens = Array.isArray(screensRaw)
        ? screensRaw.map((s) => {
            if (!s || typeof s !== 'object' || Array.isArray(s)) return s
            const o = s as Record<string, unknown>
            return {
              screenName: o['screenName'] ?? o['name'],
              route: o['route'],
            }
          })
        : []
      return { screens }
    }
    case 9:
      return ((context.phase5Output as Record<string, unknown> | undefined)?.['testing'] ??
        {}) as Record<string, unknown>
    case 10:
      return ((context.phase5Output as Record<string, unknown> | undefined)?.['cicd'] ??
        {}) as Record<string, unknown>
    case 11:
      return ((context.phase6Output as Record<string, unknown> | undefined)?.['growthStrategy'] ??
        {}) as Record<string, unknown>
    case 12:
      return ((context.phase6Output as Record<string, unknown> | undefined)?.['analytics'] ??
        {}) as Record<string, unknown>
    default:
      return {}
  }
}

export async function buildDocContent(
  doc: DocDefinition,
  context: ProjectContext,
): Promise<string> {
  const data = getRelevantOutput(doc, context)
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const prompt = `Format the following data as a professional ${doc.name} document in Markdown. Use headers, tables, and bullet points. Data: ${JSON.stringify(data)}`
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })
    const blocks = msg.content
    let text = ''
    for (const b of blocks) {
      if (b.type === 'text' && 'text' in b) text += b.text
    }
    if (text.trim().length > 0) return text
  } catch {
    /* fallback below */
  }
  return `# ${doc.name}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`
}

export async function generatePhaseDoc(
  phase: number,
  projectId: string,
  context: ProjectContext,
): Promise<void> {
  const docs = DOC_DEFINITIONS.filter((d) => d.phase === phase)
  const base = projectServiceBase()
  for (const doc of docs) {
    try {
      const content = await buildDocContent(doc, context)
      const res = await fetch(`${base}/internal/projects/${encodeURIComponent(projectId)}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Service': 'ai-service',
        },
        body: JSON.stringify({
          path: doc.path,
          content,
          language: 'markdown',
          agentType: 'doc_generator',
        }),
      })
      if (!res.ok) {
        console.error('[ai-service] doc save failed', {
          projectId,
          path: doc.path,
          status: res.status,
        })
      }
    } catch (err) {
      console.error('[ai-service] generatePhaseDoc item failed', { projectId, doc: doc.path, err })
    }
  }
}
