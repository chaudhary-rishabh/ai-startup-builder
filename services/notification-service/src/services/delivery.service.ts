import { findOrCreatePrefs } from '../db/queries/notificationPrefs.queries.js'
import { env } from '../config/env.js'
import { getRedis } from '../lib/redis.js'
import { logger } from '../lib/logger.js'
import { emailQueue } from '../queues/email.queue.js'
import { createInAppNotification } from './inApp.service.js'

import type { NotificationPrefs } from '../db/schema.js'

export interface DeliveryInput {
  userId: string
  userEmail: string
  userName?: string
  inAppData?: {
    type: string
    title: string
    body: string
    actionUrl?: string
    metadata?: Record<string, unknown>
  }
  emailData?: {
    template: string
    props: Record<string, unknown>
  }
  bypassPreferences?: boolean
}

async function loadPrefs(userId: string): Promise<NotificationPrefs> {
  const redis = getRedis()
  const cacheKey = `notif:prefs:${userId}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached) as NotificationPrefs
  const prefs = await findOrCreatePrefs(userId)
  await redis.setex(cacheKey, env.PREFS_CACHE_TTL, JSON.stringify(prefs))
  return prefs
}

function shouldSendEmail(
  input: DeliveryInput,
  prefs: NotificationPrefs,
  template: string,
): boolean {
  if (input.bypassPreferences) return true
  if (!prefs.emailEnabled) return false
  switch (template) {
    case 'phase_complete':
      return prefs.phaseComplete
    case 'billing_receipt':
    case 'subscription_cancelled':
      return prefs.billingEvents
    case 'token_warning_80':
    case 'token_warning_95':
      return prefs.tokenWarnings
    case 'rag_failed':
      return prefs.ragStatus
    case 'export_ready':
      return prefs.exportReady
    case 'security_alert':
    case 'password_reset':
    case 'email_verification':
    case 'welcome':
      return true
    default:
      return true
  }
}

function shouldSendInApp(input: DeliveryInput, prefs: NotificationPrefs, type: string): boolean {
  if (input.bypassPreferences) return true
  if (!prefs.inAppEnabled) return false
  switch (type) {
    case 'phase_complete':
      return prefs.phaseComplete
    case 'agent_done':
      return prefs.agentDone
    case 'billing_event':
      return prefs.billingEvents
    case 'token_warning':
      return prefs.tokenWarnings
    case 'rag_status':
      return prefs.ragStatus
    case 'export_ready':
      return prefs.exportReady
    case 'security_alert':
      return true
    default:
      return true
  }
}

export async function deliver(input: DeliveryInput): Promise<void> {
  const prefs = input.bypassPreferences ? null : await loadPrefs(input.userId)
  const effectivePrefs =
    prefs ??
    ({
      emailEnabled: true,
      inAppEnabled: true,
      phaseComplete: true,
      agentDone: true,
      billingEvents: true,
      tokenWarnings: true,
      ragStatus: true,
      exportReady: true,
      weeklyDigest: false,
      userId: input.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as NotificationPrefs)

  if (input.inAppData && shouldSendInApp(input, effectivePrefs, input.inAppData.type)) {
    await createInAppNotification({
      userId: input.userId,
      ...input.inAppData,
    })
  }

  if (input.emailData && shouldSendEmail(input, effectivePrefs, input.emailData.template)) {
    await emailQueue.add(
      'send',
      {
        to: input.userEmail,
        userId: input.userId,
        template: input.emailData.template,
        props: input.emailData.props,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    )
  } else if (input.emailData) {
    logger.debug('Email suppressed by preferences', {
      userId: input.userId,
      template: input.emailData.template,
    })
  }
}
