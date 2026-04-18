import { getRedis } from '../lib/redis.js'
import { logger } from '../lib/logger.js'
import { createFreeSubscription } from '../services/subscription.service.js'

const STREAM = 'platform:events'
const GROUP = 'billing-service-consumers'
const CONSUMER = 'billing-consumer-1'

let consumerShouldRun = false

function isBusyGroupError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes('BUSYGROUP')
}

export async function ensureBillingConsumerGroup(): Promise<void> {
  const redis = getRedis()
  try {
    await redis.xgroup('CREATE', STREAM, GROUP, '$', 'MKSTREAM')
  } catch (e) {
    if (!isBusyGroupError(e)) throw e
  }
}

function parsePayload(raw: string | undefined): unknown {
  if (raw === undefined) return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

export function stopBillingConsumer(): void {
  consumerShouldRun = false
}

export async function startBillingEventConsumer(): Promise<void> {
  consumerShouldRun = true
  const redis = getRedis()
  await ensureBillingConsumerGroup()

  while (consumerShouldRun) {
    try {
      const messages = await redis.xreadgroup(
        'GROUP',
        GROUP,
        CONSUMER,
        'COUNT',
        '10',
        'BLOCK',
        '5000',
        'STREAMS',
        STREAM,
        '>',
      )
      if (!consumerShouldRun) break
      if (!messages || !Array.isArray(messages)) continue

      for (const [, entries] of messages as [string, [string, string[]][]][]) {
        for (const entry of entries ?? []) {
          const id = entry[0]
          const fields = entry[1] as string[]
          const map: Record<string, string> = {}
          for (let i = 0; i < fields.length; i += 2) {
            const k = fields[i]
            const v = fields[i + 1]
            if (k !== undefined && v !== undefined) map[k] = v
          }
          const evtType = map['type']
          const payload = parsePayload(map['payload']) as
            | { userId?: string; email?: string; name?: string }
            | undefined

          if (evtType === 'user.registered' && payload?.userId && payload.email && payload.name) {
            await createFreeSubscription({
              userId: payload.userId,
              email: payload.email,
              name: payload.name,
            })
            logger.info('Free subscription created for new user', { userId: payload.userId })
          }

          await redis.xack(STREAM, GROUP, id)
        }
      }
    } catch (error) {
      logger.error('billing consumer error', { error })
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}
