import { render } from '@react-email/render'
import React from 'react'
import { Resend } from 'resend'

import { env } from '../config/env.js'
import { createEmailLog, findRecentEmailLog } from '../db/queries/emailLogs.queries.js'
import { AppError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import BillingReceiptEmail, { billingReceiptSubject } from '../templates/BillingReceiptEmail.js'
import EmailVerificationEmail, { emailVerificationSubject } from '../templates/EmailVerificationEmail.js'
import ExportReadyEmail, { exportReadySubject } from '../templates/ExportReadyEmail.js'
import PasswordResetEmail, { passwordResetSubject } from '../templates/PasswordResetEmail.js'
import PhaseCompleteEmail, { phaseCompleteSubject } from '../templates/PhaseCompleteEmail.js'
import RagFailedEmail, { ragFailedSubject } from '../templates/RagFailedEmail.js'
import SecurityAlertEmail, { securityAlertSubject } from '../templates/SecurityAlertEmail.js'
import SubscriptionCancelledEmail, {
  subscriptionCancelledSubject,
} from '../templates/SubscriptionCancelledEmail.js'
import TokenWarningEmail, { tokenWarningSubject } from '../templates/TokenWarningEmail.js'
import WelcomeEmail, { welcomeSubject } from '../templates/WelcomeEmail.js'

export interface SendEmailInput {
  to: string
  userId?: string
  template: string
  props: Record<string, unknown>
}

const resend = new Resend(env.RESEND_API_KEY)

type TemplateEntry = {
  component: React.ComponentType<any>
  subject: (props: Record<string, unknown>) => string
}

const AdminPlainEmail = (props: { title: string; body: string; actionUrl?: string | null }): React.ReactElement =>
  React.createElement(
    'html',
    null,
    React.createElement(
      'body',
      null,
      React.createElement('h2', null, props.title),
      React.createElement('p', null, props.body),
      props.actionUrl ? React.createElement('a', { href: props.actionUrl }, 'Open') : null,
    ),
  )

const TEMPLATES: Record<string, TemplateEntry> = {
  welcome: { component: WelcomeEmail, subject: () => `Welcome to ${env.APP_NAME} 🚀` },
  email_verification: { component: EmailVerificationEmail, subject: () => emailVerificationSubject },
  password_reset: { component: PasswordResetEmail, subject: () => passwordResetSubject },
  phase_complete: {
    component: PhaseCompleteEmail,
    subject: (props) =>
      phaseCompleteSubject({
        projectEmoji: String(props['projectEmoji'] ?? '🚀'),
        phaseNumber: Number(props['phaseNumber'] ?? 1),
        projectName: String(props['projectName'] ?? env.APP_NAME),
      }),
  },
  billing_receipt: {
    component: BillingReceiptEmail,
    subject: (props) => billingReceiptSubject({ planName: String(props['planName'] ?? 'Pro') }),
  },
  token_warning_80: {
    component: TokenWarningEmail,
    subject: () => tokenWarningSubject({ percentUsed: 80 }),
  },
  token_warning_95: {
    component: TokenWarningEmail,
    subject: () => tokenWarningSubject({ percentUsed: 95 }),
  },
  subscription_cancelled: { component: SubscriptionCancelledEmail, subject: () => subscriptionCancelledSubject },
  security_alert: { component: SecurityAlertEmail, subject: () => securityAlertSubject },
  rag_failed: {
    component: RagFailedEmail,
    subject: (props) => ragFailedSubject({ filename: String(props['filename'] ?? 'document') }),
  },
  export_ready: {
    component: ExportReadyEmail,
    subject: (props) =>
      exportReadySubject({
        exportFormat: String(props['exportFormat'] ?? 'ZIP'),
        projectName: String(props['projectName'] ?? 'project'),
      }),
  },
  admin_plain: {
    component: AdminPlainEmail,
    subject: (props) => String(props['title'] ?? 'Announcement'),
  },
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (input.template !== 'security_alert') {
    const existing = await findRecentEmailLog(input.to, input.template, env.EMAIL_DEDUP_TTL)
    if (existing) {
      logger.info('Email dedup: skipping duplicate', { to: input.to, template: input.template })
      return
    }
  }

  const entry = TEMPLATES[input.template]
  if (!entry) {
    throw new AppError('UNKNOWN_TEMPLATE', `Unknown email template: ${input.template}`, 422)
  }

  const html = await render(React.createElement(entry.component, input.props))
  const subject = entry.subject(input.props)
  const text = `${subject}\n\n${String(input.props['plainBody'] ?? '')}`.trim()

  let resendMessageId: string | null = null
  let status = 'sent'
  let errorMessage: string | null = null

  try {
    const response = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject,
      html,
      text,
      replyTo: env.EMAIL_REPLY_TO,
      tags: [
        { name: 'template', value: input.template },
        { name: 'environment', value: env.NODE_ENV },
      ],
    })
    resendMessageId = response.data?.id ?? null
  } catch (error) {
    status = 'failed'
    errorMessage = error instanceof Error ? error.message : 'Unknown resend error'
    logger.error('Resend email send failed', {
      to: input.to,
      template: input.template,
      error,
    })
  }

  await createEmailLog({
    userId: input.userId ?? null,
    toEmail: input.to,
    template: input.template,
    resendMessageId,
    status,
    errorMessage,
  })
}

export async function verifyResendApiKey(): Promise<void> {
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: env.EMAIL_REPLY_TO,
    subject: `${env.APP_NAME} startup dry run`,
    html: '<p>notification-service startup check</p>',
    text: 'notification-service startup check',
  })
}
