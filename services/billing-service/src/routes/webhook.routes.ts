import { Hono } from 'hono'
import Stripe from 'stripe'

import { err } from '../lib/response.js'
import { logger } from '../lib/logger.js'
import { verifyWebhookSignature } from '../services/stripe.service.js'
import { processWebhookEvent } from '../services/webhook.service.js'

const routes = new Hono()

routes.post('/webhooks/stripe', async (c) => {
  const rawBody = Buffer.from(await c.req.raw.arrayBuffer())
  const signature = c.req.header('stripe-signature')
  if (!signature) {
    return err(c, 400, 'MISSING_STRIPE_SIGNATURE', 'stripe-signature header required')
  }

  let event: Stripe.Event
  try {
    event = verifyWebhookSignature(rawBody, signature)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook signature verification failed'
    logger.warn('Webhook signature verification failed', { error: message })
    return err(c, 400, 'INVALID_STRIPE_SIGNATURE', message)
  }

  setImmediate(() => {
    void processWebhookEvent(event).catch((error) =>
      logger.error('Async webhook processing failed', {
        eventId: event.id,
        eventType: event.type,
        error,
      }),
    )
  })

  return c.json({ received: true }, 200)
})

export default routes
