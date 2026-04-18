import { and, eq, sql } from 'drizzle-orm'

import { plans, subscriptions, tokenUsage } from '../schema.js'
import { getDb } from '../../lib/db.js'

import type { TokenUsage } from '../schema.js'

export function currentMonthDateString(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
}

async function getPlanLimitForUser(userId: string): Promise<bigint> {
  const db = getDb()
  const rows = await db
    .select({ tokenLimitMonthly: plans.tokenLimitMonthly })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.userId, userId))
    .limit(1)
  const limit = rows[0]?.tokenLimitMonthly ?? 50_000
  return BigInt(limit)
}

export async function getOrCreateMonthlyUsage(userId: string, month: string): Promise<TokenUsage> {
  const db = getDb()
  const limit = await getPlanLimitForUser(userId)
  await db
    .insert(tokenUsage)
    .values({
      userId,
      month,
      tokensLimit: limit,
      tokensUsed: BigInt(0),
      costUsd: '0.0000',
    })
    .onConflictDoNothing({ target: [tokenUsage.userId, tokenUsage.month] })

  const [row] = await db
    .select()
    .from(tokenUsage)
    .where(and(eq(tokenUsage.userId, userId), eq(tokenUsage.month, month)))
    .limit(1)
  if (!row) throw new Error('getOrCreateMonthlyUsage: row missing after upsert')
  return row
}

export async function atomicIncrementUsage(
  userId: string,
  month: string,
  data: { tokensToAdd: bigint; costToAdd: number },
): Promise<TokenUsage> {
  const db = getDb()
  const [row] = await db
    .update(tokenUsage)
    .set({
      tokensUsed: sql`${tokenUsage.tokensUsed} + ${data.tokensToAdd}`,
      costUsd: sql`${tokenUsage.costUsd} + ${data.costToAdd}`,
      updatedAt: new Date(),
    })
    .where(and(eq(tokenUsage.userId, userId), eq(tokenUsage.month, month)))
    .returning()
  if (!row) throw new Error('atomicIncrementUsage: usage row not found')
  return row
}

export async function getCurrentMonthUsage(userId: string): Promise<TokenUsage | undefined> {
  const db = getDb()
  const m = currentMonthDateString()
  const [row] = await db
    .select()
    .from(tokenUsage)
    .where(and(eq(tokenUsage.userId, userId), eq(tokenUsage.month, m)))
    .limit(1)
  return row
}

export async function updateTokenLimit(userId: string, newLimit: bigint): Promise<void> {
  const db = getDb()
  const m = currentMonthDateString()
  await db
    .update(tokenUsage)
    .set({ tokensLimit: newLimit, updatedAt: new Date() })
    .where(and(eq(tokenUsage.userId, userId), eq(tokenUsage.month, m)))
}
