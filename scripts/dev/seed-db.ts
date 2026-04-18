import { join } from 'node:path'

import type { Phase1Output, Phase2Output } from '@repo/types'
import bcrypt from 'bcryptjs'
import chalk from 'chalk'
import { config as loadEnv } from 'dotenv'
import ora from 'ora'
import pg from 'pg'

import { getRepoRoot } from '../lib/repoRoot.js'

const { Pool } = pg

/** Fixed UUIDs so re-runs stay idempotent with ON CONFLICT. */
const IDS = {
  adminUser: '10000000-0000-4000-8000-000000000001',
  proUser: '10000000-0000-4000-8000-000000000002',
  freeUser: '10000000-0000-4000-8000-000000000003',
  planFree: '20000000-0000-4000-8000-000000000001',
  planPro: '20000000-0000-4000-8000-000000000002',
  planEnterprise: '20000000-0000-4000-8000-000000000003',
  subAdmin: '40000000-0000-4000-8000-000000000001',
  subPro: '40000000-0000-4000-8000-000000000002',
  subFree: '40000000-0000-4000-8000-000000000003',
  projCrm: '30000000-0000-4000-8000-000000000001',
  projDash: '30000000-0000-4000-8000-000000000002',
  projFirst: '30000000-0000-4000-8000-000000000003',
  phaseOut1: '50000000-0000-4000-8000-000000000001',
  phaseOut2: '50000000-0000-4000-8000-000000000002',
  tokPro: '60000000-0000-4000-8000-000000000001',
  tokFree: '60000000-0000-4000-8000-000000000002',
} as const

function monthStartIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

const phase1Crm: Phase1Output = {
  problem:
    'SMB sales teams lose leads in spreadsheets and lack a single view of customer conversations.',
  solution:
    'An AI-assisted CRM that auto-captures emails, suggests next actions, and surfaces churn risk.',
  icp: 'B2B SaaS companies with 10–200 employees and inside sales teams.',
  competitors: [
    {
      name: 'GenericCRM',
      features: 'Pipeline, email sync, reporting',
      pricing: '$65/user/mo',
      weakness: 'Heavy setup; weak AI-native workflows',
    },
    {
      name: 'LeadBot Pro',
      features: 'Chatbots, basic CRM',
      pricing: '$40/user/mo',
      weakness: 'Limited customization and API depth',
    },
  ],
  marketGap: 'Affordable AI-first CRM with fast time-to-value for growing teams.',
  pricingSuggest: '$49/user/mo with annual discount',
  demandScore: 78,
  risks: [{ description: 'Incumbent switching costs', severity: 'medium' }],
  verdict: 'yes',
}

const phase2Crm: Phase2Output = {
  features: [
    {
      name: 'Smart inbox',
      priority: 'must',
      description: 'Unified timeline of email + calendar + CRM notes per account.',
    },
    {
      name: 'Next-best-action',
      priority: 'should',
      description: 'LLM suggests follow-ups based on deal stage and sentiment.',
    },
    {
      name: 'Churn signals',
      priority: 'could',
      description: 'Aggregate usage + engagement drops into risk scores.',
    },
  ],
  userStories: [
    {
      role: 'sales rep',
      want: 'see all touchpoints for an account',
      soThat: 'I can prep calls without tab-hopping',
      acceptance: ['All emails synced within 5 min', 'Notes searchable'],
    },
    {
      role: 'manager',
      want: 'a pipeline health dashboard',
      soThat: 'I can coach the team on stalled deals',
      acceptance: ['Stale deal alerts', 'Export to CSV'],
    },
    {
      role: 'revops',
      want: 'webhooks for deal stage changes',
      soThat: 'we can trigger workflows in our stack',
      acceptance: ['Signed payloads', 'Retry policy documented'],
    },
  ],
  flowSteps: [
    { id: '1', label: 'Connect inbox', type: 'action' },
    { id: '2', label: 'Import accounts', type: 'action' },
    { id: '3', label: 'Review AI summary', type: 'result' },
  ],
  frontendStack: 'Next.js 15, React 19, Tailwind',
  backendStack: 'Node 22, Hono, PostgreSQL',
  dbChoice: 'PostgreSQL + Drizzle',
  authPlan: 'JWT access + httpOnly refresh, RS256',
  wireframes: [],
  designSystem: { radius: 'md', font: 'Inter' },
  componentList: ['DealCard', 'ActivityTimeline', 'RiskBadge'],
}

async function main(): Promise<void> {
  const root = getRepoRoot()
  loadEnv({ path: join(root, '.env.local') })

  const databaseUrl = process.env['DATABASE_URL']
  if (!databaseUrl) {
    console.error(chalk.red('DATABASE_URL is not set. Add it to .env.local.'))
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const stripeFree = process.env['STRIPE_PRICE_ID_FREE_MONTHLY'] ?? ''
  const stripeProM = process.env['STRIPE_PRICE_ID_PRO_MONTHLY'] ?? ''
  const stripeProY = process.env['STRIPE_PRICE_ID_PRO_YEARLY'] ?? ''
  const stripeEntM = process.env['STRIPE_PRICE_ID_ENTERPRISE_MONTHLY'] ?? ''

  const adminHash = bcrypt.hashSync('Admin123!', 10)
  const userHash = bcrypt.hashSync('Test123!', 10)
  const month = monthStartIsoDate()

  try {
    let s = ora('Seeding auth.users…').start()
    await pool.query(
      `
      INSERT INTO auth.users (
        id, email, password_hash, full_name, role, plan_tier,
        onboarding_completed, email_verified_at, status, created_at, updated_at
      ) VALUES
        ($1, 'admin@aistartupbuilder.com', $2, 'Admin User', 'super_admin', 'enterprise',
         true, NOW(), 'active', NOW(), NOW()),
        ($3, 'pro@example.com', $4, 'Pro User', 'user', 'pro',
         true, NOW(), 'active', NOW(), NOW()),
        ($5, 'free@example.com', $6, 'Free User', 'user', 'free',
         true, NOW(), 'active', NOW(), NOW())
      ON CONFLICT (email) DO NOTHING
      `,
      [IDS.adminUser, adminHash, IDS.proUser, userHash, IDS.freeUser, userHash],
    )
    s.succeed(chalk.green('Users upserted (auth.users).'))

    s = ora('Seeding users.user_profiles…').start()
    await pool.query(
      `
      INSERT INTO users.user_profiles (
        user_id, role_type, company_name, bio, timezone, notification_prefs, theme_prefs, created_at, updated_at
      ) VALUES
        ($1, 'FOUNDER', 'AI Startup Builder Inc.', 'Platform admin', 'UTC',
         '{"emailOnPhaseComplete":true,"emailOnBilling":true,"inAppAll":true}'::jsonb,
         '{"preferredMode":"design","sidebarCollapsed":false}'::jsonb, NOW(), NOW()),
        ($2, 'FOUNDER', 'TechStartup Ltd', NULL, 'UTC',
         '{"emailOnPhaseComplete":true,"emailOnBilling":true,"inAppAll":true}'::jsonb,
         '{"preferredMode":"design","sidebarCollapsed":false}'::jsonb, NOW(), NOW()),
        ($3, 'DEVELOPER', NULL, NULL, 'UTC',
         '{"emailOnPhaseComplete":true,"emailOnBilling":true,"inAppAll":true}'::jsonb,
         '{"preferredMode":"dev","sidebarCollapsed":false}'::jsonb, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING
      `,
      [IDS.adminUser, IDS.proUser, IDS.freeUser],
    )
    s.succeed(chalk.green('Profiles upserted (users.user_profiles).'))

    s = ora('Seeding billing.plans…').start()
    await pool.query(
      `
      INSERT INTO billing.plans (
        id, slug, display_name, price_monthly_usd_cents, price_yearly_usd_cents,
        stripe_price_monthly_id, stripe_price_yearly_id,
        token_limit_monthly, project_limit, features, is_active, created_at, updated_at
      ) VALUES
        ($1, 'free', 'Free', 0, 0, $4, '', 50000, 3,
         '["3 projects","50k tokens/mo"]'::jsonb, true, NOW(), NOW()),
        ($2, 'pro', 'Pro', 2900, 29000, $5, $6, 500000, -1,
         '["Unlimited projects","500k tokens/mo"]'::jsonb, true, NOW(), NOW()),
        ($3, 'enterprise', 'Enterprise', 9900, 99000, $7, '', 2000000, -1,
         '["Unlimited projects","2M tokens/mo","priority support"]'::jsonb, true, NOW(), NOW())
      ON CONFLICT (slug) DO NOTHING
      `,
      [IDS.planFree, IDS.planPro, IDS.planEnterprise, stripeFree, stripeProM, stripeProY, stripeEntM],
    )
    s.succeed(chalk.green('Plans upserted (billing.plans).'))

    s = ora('Seeding billing.subscriptions…').start()
    await pool.query(
      `
      INSERT INTO billing.subscriptions (
        id, user_id, plan_id, stripe_customer_id, stripe_subscription_id, status,
        billing_cycle, cancel_at_period_end, created_at, updated_at
      ) VALUES
        ($1, $2, $3, '', NULL, 'active', 'monthly', false, NOW(), NOW()),
        ($4, $5, $6, '', NULL, 'active', 'monthly', false, NOW(), NOW()),
        ($7, $8, $9, '', NULL, 'active', 'monthly', false, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING
      `,
      [
        IDS.subAdmin,
        IDS.adminUser,
        IDS.planEnterprise,
        IDS.subPro,
        IDS.proUser,
        IDS.planPro,
        IDS.subFree,
        IDS.freeUser,
        IDS.planFree,
      ],
    )
    s.succeed(chalk.green('Subscriptions upserted (billing.subscriptions).'))

    s = ora('Seeding projects.projects…').start()
    await pool.query(
      `
      INSERT INTO projects.projects (
        id, user_id, name, description, emoji, current_phase, status, is_starred, mode,
        phase_progress, context_summary, last_active_at, created_at, updated_at
      ) VALUES
        ($1, $2, 'AI-Powered CRM', 'CRM with AI-assisted follow-ups', '🤖', 2, 'active', false, 'design',
         '{}'::jsonb, NULL, NOW(), NOW(), NOW()),
        ($3, $4, 'SaaS Analytics Dashboard', 'Usage and revenue analytics', '📊', 1, 'active', true, 'design',
         '{}'::jsonb, NULL, NOW(), NOW(), NOW()),
        ($5, $6, 'My First Startup', 'First idea workspace', '🚀', 1, 'active', false, 'design',
         '{}'::jsonb, NULL, NOW(), NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
      `,
      [IDS.projCrm, IDS.proUser, IDS.projDash, IDS.proUser, IDS.projFirst, IDS.freeUser],
    )
    s.succeed(chalk.green('Projects upserted (projects.projects).'))

    s = ora('Seeding projects.phase_outputs…').start()
    await pool.query(
      `
      INSERT INTO projects.phase_outputs (
        id, project_id, phase, output_data, version, is_current, created_at
      ) VALUES
        ($1, $2, 1, $3::jsonb, 1, true, NOW()),
        ($4, $5, 2, $6::jsonb, 1, true, NOW())
      ON CONFLICT (project_id, phase) DO NOTHING
      `,
      [
        IDS.phaseOut1,
        IDS.projCrm,
        JSON.stringify(phase1Crm),
        IDS.phaseOut2,
        IDS.projCrm,
        JSON.stringify(phase2Crm),
      ],
    )
    s.succeed(chalk.green('Phase outputs upserted (projects.phase_outputs).'))

    s = ora('Seeding billing.token_usage…').start()
    await pool.query(
      `
      INSERT INTO billing.token_usage (
        id, user_id, month, tokens_used, tokens_limit, cost_usd, updated_at
      ) VALUES
        ($1, $2, $3::date, 125000, 500000, '0.0000', NOW()),
        ($4, $5, $3::date, 12000, 50000, '0.0000', NOW())
      ON CONFLICT (user_id, month) DO NOTHING
      `,
      [IDS.tokPro, IDS.proUser, month, IDS.tokFree, IDS.freeUser],
    )
    s.succeed(chalk.green('Token usage upserted (billing.token_usage).'))

    console.log()
    console.log(chalk.bold.green('Seeded: 3 users, 3 plans, 3 subscriptions, 3 projects, 2 phase outputs'))
  } catch (e) {
    console.error(chalk.red('Seed failed:'), e)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

await main()
