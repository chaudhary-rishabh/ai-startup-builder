import { and, count, desc, eq } from 'drizzle-orm'

import { transactions } from '../schema.js'
import { getDb } from '../../lib/db.js'

import type { NewTransaction, Transaction } from '../schema.js'

export async function createTransaction(data: NewTransaction): Promise<Transaction> {
  const db = getDb()
  const [row] = await db.insert(transactions).values(data).returning()
  if (!row) throw new Error('createTransaction: insert returned no row')
  return row
}

export async function findTransactionByStripeInvoiceId(
  invoiceId: string,
): Promise<Transaction | undefined> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.stripeInvoiceId, invoiceId))
    .limit(1)
  return row
}

export async function findTransactionByStripeEventId(
  eventId: string,
): Promise<Transaction | undefined> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.stripeEventId, eventId))
    .limit(1)
  return row
}

export async function findTransactionById(id: string): Promise<Transaction | undefined> {
  const db = getDb()
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1)
  return row
}

export async function findTransactionsByUserId(
  userId: string,
  opts: { page?: number; limit?: number },
): Promise<{ data: Transaction[]; total: number }> {
  const db = getDb()
  const page = Math.max(1, opts.page ?? 1)
  const limit = Math.min(100, Math.max(1, opts.limit ?? 10))
  const offset = (page - 1) * limit

  const data = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit)
    .offset(offset)

  const [r] = await db.select({ c: count() }).from(transactions).where(eq(transactions.userId, userId))
  return { data, total: Number(r?.c ?? 0) }
}

export async function updateTransactionRefund(
  id: string,
  data: { refundedAmountCents: number; refundedAt: Date; status: string },
): Promise<Transaction> {
  const db = getDb()
  const [row] = await db
    .update(transactions)
    .set({
      refundedAmountCents: data.refundedAmountCents,
      refundedAt: data.refundedAt,
      status: data.status as Transaction['status'],
    })
    .where(and(eq(transactions.id, id)))
    .returning()
  if (!row) throw new Error('updateTransactionRefund: transaction not found')
  return row
}
