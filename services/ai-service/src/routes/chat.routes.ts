import { zValidator } from '@hono/zod-validator'
import Anthropic from '@anthropic-ai/sdk'
import { Hono } from 'hono'
import { z } from 'zod'

import { env } from '../config/env.js'
import { err, ok } from '../lib/response.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { estimateCost } from '../services/modelRouter.service.js'
import { checkTokenBudget, recordTokenUsage } from '../services/tokenBudget.service.js'

const ChatBodySchema = z.object({
  content: z.string().min(1).max(100_000),
  model: z.enum(['claude-sonnet-4-5', 'claude-opus-4-5']).optional(),
})

const routes = new Hono()
routes.use('*', requireAuth)

routes.post('/chat', zValidator('json', ChatBodySchema), async (c) => {
  const userId = c.get('userId' as never) as string
  const body = c.req.valid('json')
  const model = body.model ?? 'claude-sonnet-4-5'
  const estimated = Math.ceil(body.content.length / 4) + 4096
  const userEmail = (c.get('userEmail' as never) as string | undefined) ?? ''
  const userName = (c.get('userName' as never) as string | undefined) ?? ''
  const budget = await checkTokenBudget(userId, estimated, {
    ...(userEmail !== '' ? { userEmail, userName } : {}),
  })
  if (!budget.allowed) {
    if (budget.creditState === 'exhausted') {
      return err(c, 422, 'CREDITS_EXHAUSTED', 'Your free credits have been used. Upgrade to continue building.')
    }
    return err(c, 422, 'TOKEN_BUDGET_EXCEEDED', 'Token budget exceeded for this billing period')
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const msg = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: body.content }],
  })
  const text = msg.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
  const usage = msg.usage
  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0
  const tokensUsed = inputTokens + outputTokens
  const costUsd = estimateCost(model, inputTokens, outputTokens)
  await recordTokenUsage(userId, tokensUsed, costUsd)

  return ok(c, {
    content: text,
    model,
    inputTokens,
    outputTokens,
    tokensUsed,
  })
})

export default routes
