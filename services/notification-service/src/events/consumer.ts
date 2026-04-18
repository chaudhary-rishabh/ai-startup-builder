import { env } from '../config/env.js'
import { findOrCreatePrefs } from '../db/queries/notificationPrefs.queries.js'
import { logger } from '../lib/logger.js'
import { getRedis } from '../lib/redis.js'
import { deliver } from '../services/delivery.service.js'

const STREAM = 'platform:events'
const GROUP = 'notification-service-consumers'
const CONSUMER = 'notification-consumer-1'

let shouldRun = false

function isBusyGroupError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e)
  return message.includes('BUSYGROUP')
}

function parsePayload(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return undefined
  }
}

function getFirstOfNextMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const PHASE_NAMES: Record<number, string> = {
  1: 'Validation',
  2: 'Planning',
  3: 'Design',
  4: 'Build',
  5: 'Testing & Deploy',
  6: 'Growth',
}

const PHASE_ROUTE_MAP: Record<number, string> = {
  2: 'plan',
  3: 'design',
  4: 'build',
  5: 'deploy',
  6: 'growth',
}

async function handleUserRegistered(payload: Record<string, unknown>): Promise<void> {
  const userId = String(payload['userId'] ?? '')
  const userEmail = String(payload['email'] ?? '')
  const userName = String(payload['name'] ?? 'Founder')
  if (!userId || !userEmail) return
  await findOrCreatePrefs(userId)
  await deliver({
    userId,
    userEmail,
    userName,
    inAppData: {
      type: 'system_alert',
      title: `Welcome to ${env.APP_NAME}!`,
      body: 'Your account is ready. Start your first project.',
      actionUrl: `${env.APP_URL}/dashboard`,
    },
    emailData: {
      template: 'welcome',
      props: { name: userName },
    },
  })
}

async function handleEmailVerification(payload: Record<string, unknown>): Promise<void> {
  await deliver({
    userId: String(payload['userId'] ?? ''),
    userEmail: String(payload['email'] ?? ''),
    userName: String(payload['name'] ?? 'Founder'),
    emailData: {
      template: 'email_verification',
      props: {
        name: String(payload['name'] ?? 'Founder'),
        verifyUrl: String(payload['verifyUrl'] ?? ''),
        expiresInMinutes: Number(payload['expiresInMinutes'] ?? 30),
      },
    },
    bypassPreferences: true,
  })
}

async function handlePasswordReset(payload: Record<string, unknown>): Promise<void> {
  await deliver({
    userId: String(payload['userId'] ?? ''),
    userEmail: String(payload['email'] ?? ''),
    userName: String(payload['name'] ?? 'Founder'),
    emailData: {
      template: 'password_reset',
      props: {
        name: String(payload['name'] ?? 'Founder'),
        resetUrl: String(payload['resetUrl'] ?? ''),
        expiresInMinutes: Number(payload['expiresInMinutes'] ?? 30),
        ipAddress: payload['ipAddress'] ? String(payload['ipAddress']) : undefined,
      },
    },
    bypassPreferences: true,
  })
}

async function handlePhaseAdvanced(payload: Record<string, unknown>): Promise<void> {
  const fromPhase = Number(payload['fromPhase'] ?? 1)
  const toPhase = Number(payload['toPhase'] ?? 2)
  const completedPhase = PHASE_NAMES[fromPhase] ?? 'Completed'
  const nextPhase = PHASE_NAMES[toPhase] ?? 'Next Phase'
  const nextRoute = PHASE_ROUTE_MAP[toPhase] ?? 'dashboard'
  const projectId = String(payload['projectId'] ?? '')
  const actionUrl = `${env.APP_URL}/project/${projectId}/${nextRoute}`
  await deliver({
    userId: String(payload['userId'] ?? ''),
    userEmail: String(payload['userEmail'] ?? payload['email'] ?? ''),
    userName: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
    inAppData: {
      type: 'phase_complete',
      title: `Phase ${fromPhase} Complete — ${String(payload['projectName'] ?? 'Project')}`,
      body: `${String(payload['projectEmoji'] ?? '🚀')} ${completedPhase} is done. Time to ${nextPhase.toLowerCase()}!`,
      actionUrl,
      metadata: { projectId, phase: fromPhase },
    },
    emailData: {
      template: 'phase_complete',
      props: {
        name: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
        projectName: String(payload['projectName'] ?? 'Project'),
        projectEmoji: String(payload['projectEmoji'] ?? '🚀'),
        phaseNumber: fromPhase,
        phaseName: completedPhase,
        nextPhaseName: nextPhase,
        nextPhaseUrl: actionUrl,
        highlights: [],
      },
    },
  })
}

async function handleInvoicePaid(payload: Record<string, unknown>): Promise<void> {
  const currency = String(payload['currency'] ?? 'usd')
  const amountCents = Number(payload['amountCents'] ?? 0)
  const amountFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100)
  await deliver({
    userId: String(payload['userId'] ?? ''),
    userEmail: String(payload['userEmail'] ?? payload['email'] ?? ''),
    userName: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
    inAppData: {
      type: 'billing_event',
      title: 'Payment Successful',
      body: `${amountFormatted} charged for ${String(payload['planName'] ?? 'Pro')} plan.`,
      actionUrl: `${env.APP_URL}/settings/billing`,
      metadata: { invoiceId: payload['invoiceId'] },
    },
    emailData: {
      template: 'billing_receipt',
      props: {
        name: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
        planName: String(payload['planName'] ?? 'Pro'),
        amountFormatted,
        currency,
        periodStart: new Date().toLocaleDateString(),
        periodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleDateString(),
        invoiceUrl: payload['receiptUrl'] ? String(payload['receiptUrl']) : null,
        billingPortalUrl: `${env.APP_URL}/settings/billing`,
      },
    },
  })
}

async function handleTokenBudgetWarning(payload: Record<string, unknown>): Promise<void> {
  const percentUsed = Number(payload['percentUsed'] ?? 80) as 80 | 95
  const template = percentUsed === 95 ? 'token_warning_95' : 'token_warning_80'
  const tokenLimit = Number(payload['tokenLimit'] ?? 0)
  const tokensUsed = Number(payload['tokensUsed'] ?? 0)
  const tokensRemaining = tokenLimit - tokensUsed
  const resetDate = getFirstOfNextMonth()
  await deliver({
    userId: String(payload['userId'] ?? ''),
    userEmail: String(payload['userEmail'] ?? payload['email'] ?? ''),
    userName: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
    inAppData: {
      type: 'token_warning',
      title: `${percentUsed}% of tokens used this month`,
      body: `${tokensRemaining.toLocaleString()} tokens remaining. Resets ${resetDate}.`,
      actionUrl: `${env.APP_URL}/settings/billing`,
      metadata: { percentUsed, tokensUsed },
    },
    emailData: {
      template,
      props: {
        name: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
        percentUsed,
        tokensUsed,
        tokensLimit: tokenLimit,
        tokensRemaining,
        planName: String(payload['planName'] ?? 'Pro'),
        upgradeUrl: `${env.APP_URL}/settings/billing?upgrade=1`,
        resetDate,
      },
    },
  })
}

async function handleSubscriptionCancelled(payload: Record<string, unknown>): Promise<void> {
  const accessUntil = String(payload['accessUntil'] ?? new Date().toISOString())
  const accessUntilFormatted = new Date(accessUntil).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  await deliver({
    userId: String(payload['userId'] ?? ''),
    userEmail: String(payload['userEmail'] ?? payload['email'] ?? ''),
    userName: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
    inAppData: {
      type: 'billing_event',
      title: 'Subscription Cancelled',
      body: `You'll have access until ${accessUntilFormatted}.`,
      actionUrl: `${env.APP_URL}/settings/billing`,
    },
    emailData: {
      template: 'subscription_cancelled',
      props: {
        name: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
        planName: String(payload['plan'] ?? 'Pro'),
        accessUntil: accessUntilFormatted,
        dashboardUrl: `${env.APP_URL}/dashboard`,
        reactivateUrl: `${env.APP_URL}/settings/billing?reactivate=1`,
      },
    },
  })
}

async function handlePaymentFailed(payload: Record<string, unknown>): Promise<void> {
  await deliver({
    userId: String(payload['userId'] ?? ''),
    userEmail: String(payload['userEmail'] ?? payload['email'] ?? ''),
    userName: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
    inAppData: {
      type: 'billing_event',
      title: 'Payment Failed',
      body: 'Your last payment was declined. Please update your payment method.',
      actionUrl: `${env.APP_URL}/settings/billing`,
    },
  })
}

async function handleBruteForce(payload: Record<string, unknown>): Promise<void> {
  await deliver({
    userId: String(payload['userId'] ?? ''),
    userEmail: String(payload['userEmail'] ?? payload['email'] ?? ''),
    userName: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
    inAppData: {
      type: 'security_alert',
      title: 'Security Alert',
      body: `${Number(payload['attempts'] ?? 0)} failed login attempts detected from ${String(payload['ipAddress'] ?? 'unknown')}.`,
      actionUrl: `${env.APP_URL}/settings?tab=security`,
      metadata: {
        ipAddress: String(payload['ipAddress'] ?? ''),
        attempts: Number(payload['attempts'] ?? 0),
      },
    },
    emailData: {
      template: 'security_alert',
      props: {
        name: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
        eventType: 'brute_force',
        ipAddress: String(payload['ipAddress'] ?? ''),
        timestamp: new Date().toISOString(),
        actionUrl: `${env.APP_URL}/settings?tab=security`,
      },
    },
    bypassPreferences: true,
  })
}

async function handleRagFailed(payload: Record<string, unknown>): Promise<void> {
  await deliver({
    userId: String(payload['userId'] ?? ''),
    userEmail: String(payload['userEmail'] ?? payload['email'] ?? ''),
    userName: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
    inAppData: {
      type: 'rag_status',
      title: 'Document Indexing Failed',
      body: `Could not process "${String(payload['filename'] ?? 'document')}". Tap to retry.`,
      actionUrl: `${env.APP_URL}/rag`,
      metadata: {
        docId: String(payload['docId'] ?? ''),
        filename: String(payload['filename'] ?? ''),
      },
    },
    emailData: {
      template: 'rag_failed',
      props: {
        name: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
        filename: String(payload['filename'] ?? 'document'),
        errorMessage: String(payload['error'] ?? 'Unknown error'),
        retryUrl: `${env.APP_URL}/rag`,
      },
    },
  })
}

async function handleExportCompleted(payload: Record<string, unknown>): Promise<void> {
  await deliver({
    userId: String(payload['userId'] ?? ''),
    userEmail: String(payload['userEmail'] ?? payload['email'] ?? ''),
    userName: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
    inAppData: {
      type: 'export_ready',
      title: `${String(payload['exportFormat'] ?? 'ZIP')} Export Ready`,
      body: `${String(payload['projectName'] ?? 'Project')} export is ready to download.`,
      actionUrl: String(payload['downloadUrl'] ?? env.APP_URL),
    },
    emailData: {
      template: 'export_ready',
      props: {
        name: String(payload['userName'] ?? payload['name'] ?? 'Founder'),
        projectName: String(payload['projectName'] ?? 'Project'),
        exportFormat: String(payload['exportFormat'] ?? 'ZIP'),
        downloadUrl: String(payload['downloadUrl'] ?? env.APP_URL),
        expiresInHours: Number(payload['expiresInHours'] ?? 24),
      },
    },
  })
}

export async function processNotificationEvent(type: string, payload: Record<string, unknown>): Promise<void> {
  switch (type) {
    case 'user.registered':
      return handleUserRegistered(payload)
    case 'user.email.verification':
      return handleEmailVerification(payload)
    case 'user.password.reset':
      return handlePasswordReset(payload)
    case 'project.phase.advanced':
      return handlePhaseAdvanced(payload)
    case 'invoice.paid':
      return handleInvoicePaid(payload)
    case 'token.budget.warning':
      return handleTokenBudgetWarning(payload)
    case 'subscription.cancelled':
      return handleSubscriptionCancelled(payload)
    case 'subscription.payment_failed':
      return handlePaymentFailed(payload)
    case 'auth.brute_force.detected':
      return handleBruteForce(payload)
    case 'document.indexing.failed':
      return handleRagFailed(payload)
    case 'export.completed':
      return handleExportCompleted(payload)
    default:
      logger.debug('Unhandled notification event type', { type })
  }
}

export async function ensureNotificationConsumerGroup(): Promise<void> {
  const redis = getRedis()
  try {
    await redis.xgroup('CREATE', STREAM, GROUP, '$', 'MKSTREAM')
  } catch (error) {
    if (!isBusyGroupError(error)) throw error
  }
}

export function stopNotificationConsumer(): void {
  shouldRun = false
}

export async function startNotificationEventConsumer(): Promise<void> {
  shouldRun = true
  const redis = getRedis()
  await ensureNotificationConsumerGroup()

  while (shouldRun) {
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
      if (!messages || !Array.isArray(messages)) continue
      for (const [, entries] of messages as [string, [string, string[]][]][]) {
        for (const entry of entries ?? []) {
          const id = entry[0]
          const fields = entry[1] as string[]
          const map: Record<string, string> = {}
          for (let i = 0; i < fields.length; i += 2) {
            const key = fields[i]
            const value = fields[i + 1]
            if (key !== undefined && value !== undefined) map[key] = value
          }

          const type = map['type']
          const payload = parsePayload(map['payload']) ?? {}
          try {
            if (type) await processNotificationEvent(type, payload)
          } catch (error) {
            logger.error('Notification event handler error', { type, id, error })
          }
          await redis.xack(STREAM, GROUP, id)
        }
      }
    } catch (error) {
      logger.error('notification consumer error', { error })
      await new Promise((resolve) => setTimeout(resolve, 5_000))
    }
  }
}
