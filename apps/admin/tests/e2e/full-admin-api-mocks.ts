import type { Page } from '@playwright/test'
import { installAdminApiMocks } from './api-mocks'

function ok<T>(data: T) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  }
}

/** Playwright network mocks for authenticated admin shell pages (mirrors MSW handlers). */
export async function installFullAdminApiMocks(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace(/^.*\/api\/v1/, '')
    const method = req.method()

    // ── Dashboard ───────────────────────────────────────────────────────────
    if (method === 'GET' && path === '/admin/kpis') {
      return route.fulfill(
        ok({
          totalUsers: 12847,
          activeToday: 1204,
          newThisWeek: 312,
          totalProjects: 34521,
          totalRevenueCents: 2480000,
          avgSessionMinutes: 28,
          changes: {
            totalUsers: 8.4,
            activeToday: 12.1,
            newThisWeek: -3.2,
            totalProjects: 11.7,
            totalRevenue: 14.3,
            avgSession: 2.1,
          },
        }),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/revenue')) {
      return route.fulfill(
        ok([
          {
            month: 'Jan 2025',
            mrr: 1800000,
            newMrr: 240000,
            churnedMrr: 42000,
          },
          {
            month: 'Feb 2025',
            mrr: 1920000,
            newMrr: 160000,
            churnedMrr: 40000,
          },
        ]),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/user-growth')) {
      return route.fulfill(
        ok([
          { week: 'Week of Mar 3', signups: 48, churned: 4 },
          { week: 'Week of Mar 10', signups: 71, churned: 6 },
        ]),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/users/recent')) {
      return route.fulfill(
        ok([
          {
            id: 'u-1',
            name: 'Priya Sharma',
            email: 'priya@startup.io',
            avatarUrl: null,
            plan: 'pro',
            signedUpAt: new Date().toISOString(),
            status: 'active',
          },
        ]),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/activity')) {
      return route.fulfill(
        ok([
          {
            id: 'ev-1',
            type: 'user.upgrade',
            actorName: 'Priya Sharma',
            actorAvatarUrl: null,
            description: 'Upgraded from Free to Pro',
            metadata: {},
            occurredAt: new Date().toISOString(),
          },
        ]),
      )
    }

    // ── Users ───────────────────────────────────────────────────────────────
    if (
      method === 'GET' &&
      /^\/admin\/users\/[^/]+$/.test(path) &&
      path !== '/admin/users'
    ) {
      const userId = path.split('/').pop() ?? 'u-1'
      return route.fulfill(
        ok({
          id: userId,
          name: 'Priya Sharma',
          email: 'priya@startup.io',
          avatarUrl: null,
          plan: 'pro',
          projectCount: 4,
          tokensUsedThisMonth: 48200,
          joinedAt: new Date().toISOString(),
          status: 'active',
          lastActiveAt: new Date().toISOString(),
          role: 'user',
          bio: 'Building in public',
          company: 'StartupLab',
          website: 'https://startuplab.io',
          timezone: 'Asia/Kolkata',
          onboardingDone: true,
          totalTokensUsed: 284000,
          agentRunsTotal: 47,
          agentRunsThisMonth: 12,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          adminNotes: '',
          topAgentBreakdown: [],
        }),
      )
    }

    if (method === 'GET' && path === '/admin/users') {
      const pageNum = Number(url.searchParams.get('page') ?? 1)
      return route.fulfill(
        ok({
          users: [
            {
              id: 'u-1',
              name: 'Priya Sharma',
              email: 'priya@startup.io',
              avatarUrl: null,
              plan: 'pro',
              projectCount: 4,
              tokensUsedThisMonth: 48200,
              joinedAt: new Date().toISOString(),
              status: 'active',
              lastActiveAt: new Date().toISOString(),
            },
            {
              id: 'u-2',
              name: 'Marcus Chen',
              email: 'marcus@idea.co',
              avatarUrl: null,
              plan: 'free',
              projectCount: 1,
              tokensUsedThisMonth: 3100,
              joinedAt: new Date().toISOString(),
              status: 'unverified',
              lastActiveAt: null,
            },
            {
              id: 'u-3',
              name: "Sarah O'Brien",
              email: 'sarah@builder.xyz',
              avatarUrl: null,
              plan: 'pro',
              projectCount: 7,
              tokensUsedThisMonth: 112000,
              joinedAt: new Date().toISOString(),
              status: 'suspended',
              lastActiveAt: new Date().toISOString(),
            },
          ],
          total: 3,
          page: pageNum,
          limit: 25,
          totalPages: 1,
        }),
      )
    }

    // ── Billing ─────────────────────────────────────────────────────────────
    if (method === 'GET' && path.startsWith('/admin/billing/summary')) {
      return route.fulfill(
        ok({
          mrrCents: 2480000,
          arrCents: 29760000,
          churnRate: 2.4,
          ltv: 84000,
          changes: { mrr: 14.3, arr: 14.3, churnRate: -0.2, ltv: 8.1 },
        }),
      )
    }
    if (method === 'GET' && path === '/admin/billing/plans') {
      return route.fulfill(
        ok([
          {
            id: 'plan-1',
            tier: 'free',
            name: 'Free',
            priceMonthly: 0,
            priceYearly: 0,
            tokenLimit: 50000,
            projectLimit: 3,
            features: ['Phase 1 & 2'],
            userCount: 8204,
            monthlyRevenueCents: 0,
            stripePriceId: null,
          },
          {
            id: 'plan-2',
            tier: 'pro',
            name: 'Pro',
            priceMonthly: 2900,
            priceYearly: 29000,
            tokenLimit: 500000,
            projectLimit: 20,
            features: ['All phases', '500K tokens'],
            userCount: 4512,
            monthlyRevenueCents: 2480000,
            stripePriceId: 'price_test_pro',
          },
        ]),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/billing/transactions')) {
      return route.fulfill(
        ok({
          transactions: [
            {
              id: 'tx-1',
              userId: 'u-1',
              userName: 'Priya Sharma',
              userEmail: 'priya@startup.io',
              amountCents: 2900,
              currency: 'usd',
              status: 'succeeded',
              plan: 'pro',
              description: 'Pro monthly',
              refundedAmountCents: 0,
              invoicePdfUrl: 'https://stripe.com/invoice/test',
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          totalPages: 1,
        }),
      )
    }
    if (method === 'GET' && path === '/admin/billing/coupons') {
      return route.fulfill(
        ok([
          {
            id: 'coup-1',
            code: 'LAUNCH50',
            discountType: 'percent',
            discountValue: 50,
            maxUses: 100,
            usedCount: 23,
            expiresAt: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            stripeCouponId: 'coupon_test',
            createdAt: new Date().toISOString(),
          },
        ]),
      )
    }

    // ── AI usage ───────────────────────────────────────────────────────────
    if (method === 'GET' && path.startsWith('/analytics/admin/ai-usage/overview')) {
      return route.fulfill(
        ok({
          tokensToday: 2847000,
          tokensThisMonth: 48200000,
          projectedCostUsd: 1842.3,
          costThisMonthUsd: 1204.8,
          exhaustedUsersCount: 12,
        }),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/ai-usage/tokens')) {
      return route.fulfill(
        ok([
          { date: 'Apr 1', tokens: 1200000, costUsd: 24.8 },
          { date: 'Apr 7', tokens: 1840000, costUsd: 38.2 },
        ]),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/ai-usage/models')) {
      return route.fulfill(
        ok([
          {
            model: 'claude-sonnet-4-6',
            requests: 48200,
            tokens: 38400000,
            avgLatencyMs: 2840,
            costUsd: 960.0,
            sharePercent: 79.6,
          },
          {
            model: 'gpt-4o',
            requests: 8400,
            tokens: 9800000,
            avgLatencyMs: 1840,
            costUsd: 244.8,
            sharePercent: 20.4,
          },
        ]),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/ai-usage/top-users')) {
      return route.fulfill(
        ok([
          {
            userId: 'u-3',
            userName: "Sarah O'Brien",
            userEmail: 'sarah@builder.xyz',
            plan: 'pro',
            tokensThisMonth: 112000,
            tokenLimit: 500000,
            percentOfLimit: 22.4,
            projectedOverage: 0,
          },
        ]),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/ai-usage/agents')) {
      return route.fulfill(
        ok([
          {
            agentType: 'frontend',
            tokens: 12400000,
            requests: 8200,
            avgTokensPerRun: 1512,
            costUsd: 310.0,
          },
          {
            agentType: 'backend',
            tokens: 9800000,
            requests: 7400,
            avgTokensPerRun: 1324,
            costUsd: 245.0,
          },
        ]),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/ai-usage/limits')) {
      return route.fulfill(
        ok([
          { plan: 'free', tokenLimit: 50000, isUnlimited: false },
          { plan: 'pro', tokenLimit: 500000, isUnlimited: false },
          { plan: 'enterprise', tokenLimit: 0, isUnlimited: true },
        ]),
      )
    }

    // ── Projects ────────────────────────────────────────────────────────────
    if (method === 'GET' && path === '/admin/projects') {
      return route.fulfill(
        ok({
          projects: [
            {
              id: 'proj-1',
              name: 'RestaurantIQ',
              emoji: '🍽️',
              userId: 'u-1',
              userName: 'Priya Sharma',
              userEmail: 'priya@startup.io',
              currentPhase: 4,
              status: 'active',
              buildMode: 'copilot',
              agentRunCount: 47,
              tokensUsed: 284000,
              lastActiveAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
            {
              id: 'proj-2',
              name: 'HealthAI Coach',
              emoji: '🏥',
              userId: 'u-3',
              userName: "Sarah O'Brien",
              userEmail: 'sarah@builder.xyz',
              currentPhase: 6,
              status: 'launched',
              buildMode: 'autopilot',
              agentRunCount: 120,
              tokensUsed: 890000,
              lastActiveAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
          ],
          total: 2,
          page: 1,
          totalPages: 1,
        }),
      )
    }

    // ── System ───────────────────────────────────────────────────────────────
    if (method === 'GET' && path.startsWith('/admin/system/health')) {
      return route.fulfill(
        ok([
          {
            name: 'API Gateway',
            status: 'up',
            uptimePercent: 99.98,
            lastIncidentAt: null,
            responseTimeMs: 42,
            endpoint: '/health',
          },
          {
            name: 'Database',
            status: 'up',
            uptimePercent: 99.99,
            lastIncidentAt: null,
            responseTimeMs: 8,
            endpoint: '/health',
          },
          {
            name: 'AI Proxy',
            status: 'degraded',
            uptimePercent: 98.4,
            lastIncidentAt: new Date().toISOString(),
            responseTimeMs: 1840,
            endpoint: '/health',
          },
          {
            name: 'Auth',
            status: 'up',
            uptimePercent: 99.97,
            lastIncidentAt: null,
            responseTimeMs: 24,
            endpoint: '/health',
          },
          {
            name: 'Storage',
            status: 'up',
            uptimePercent: 100,
            lastIncidentAt: null,
            responseTimeMs: 18,
            endpoint: '/health',
          },
          {
            name: 'Queue',
            status: 'up',
            uptimePercent: 99.95,
            lastIncidentAt: null,
            responseTimeMs: 12,
            endpoint: '/health',
          },
        ]),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/system/errors')) {
      return route.fulfill(
        ok({
          errors: [
            {
              id: 'err-1',
              severity: 'error',
              type: 'UnhandledPromiseRejection',
              endpoint: 'POST /ai/runs',
              userId: 'u-1',
              userEmail: 'p***@startup.io',
              userEmailUnmasked: 'priya@startup.io',
              message: 'Claude API timeout after 30s',
              stack: 'Error: timeout\n    at AgentRunner.run (/src/agents/base.ts:42)',
              occurredAt: new Date().toISOString(),
            },
            {
              id: 'err-2',
              severity: 'warning',
              type: 'RateLimitApproach',
              endpoint: 'GET /rag/documents',
              userId: null,
              userEmail: null,
              message: 'Rate limit at 85% for user namespace',
              stack: null,
              occurredAt: new Date().toISOString(),
            },
          ],
          total: 2,
        }),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/system/latency')) {
      const points = Array.from({ length: 8 }, (_, i) => ({
        time: `0${i}:00`,
        p50: 80,
        p95: 200,
        p99: 400,
      }))
      return route.fulfill(ok(points))
    }

    // ── Audit ───────────────────────────────────────────────────────────────
    if (method === 'GET' && path === '/admin/audit') {
      return route.fulfill(
        ok({
          logs: [
            {
              id: 'aud-1',
              adminId: 'admin-1',
              adminEmail: 'admin@example.com',
              adminName: 'Super Admin',
              action: 'user.suspended',
              targetType: 'user',
              targetId: 'u-2',
              targetLabel: 'marcus@idea.co',
              beforeState: { status: 'active' },
              afterState: { status: 'suspended' },
              ipAddress: '203.0.113.1',
              userAgent: 'Mozilla Chrome/120',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'aud-2',
              adminId: 'admin-1',
              adminEmail: 'admin@example.com',
              adminName: 'Super Admin',
              action: 'refund.issued',
              targetType: 'user',
              targetId: 'u-1',
              targetLabel: 'priya@startup.io',
              beforeState: { refundedAmount: 0 },
              afterState: { refundedAmount: 2900 },
              ipAddress: '203.0.113.1',
              userAgent: 'Mozilla Chrome/120',
              createdAt: new Date().toISOString(),
            },
          ],
          total: 2,
          page: 1,
          totalPages: 1,
        }),
      )
    }

    // ── Settings ────────────────────────────────────────────────────────────
    if (method === 'GET' && path === '/admin/settings/general') {
      return route.fulfill(
        ok({
          platformName: 'AI Startup Builder',
          supportEmail: 'support@aistartupbuilder.com',
          timezone: 'America/New_York',
          maintenanceMode: false,
          maintenanceMessage: "We'll be back shortly.",
          logoUrl: null,
        }),
      )
    }
    if (method === 'GET' && path === '/admin/settings/email') {
      return route.fulfill(
        ok({
          provider: 'resend',
          apiKey: 're_••••••••••••1234',
          fromEmail: 'hello@aistartupbuilder.com',
          fromName: 'AI Startup Builder',
        }),
      )
    }
    if (method === 'GET' && path.startsWith('/admin/settings/email/templates')) {
      return route.fulfill(
        ok([
          {
            key: 'welcome',
            subject: 'Welcome to AI Startup Builder 🚀',
            previewText: "You're in! Here's how to get started...",
          },
          {
            key: 'reset_password',
            subject: 'Reset your password',
            previewText: 'Click the link below to reset your password...',
          },
          {
            key: 'billing_receipt',
            subject: 'Your receipt from AI Startup Builder',
            previewText: "Thank you for your payment. Here's your receipt...",
          },
          {
            key: 'phase_complete',
            subject: '🎉 Phase complete!',
            previewText:
              'Great work! Your project has advanced to the next phase...',
          },
          {
            key: 'agent_done',
            subject: '🤖 Your AI agent finished',
            previewText: 'Your agent has finished generating results for...',
          },
          {
            key: 'system_alert',
            subject: '⚠️ System alert',
            previewText:
              "We've detected something that needs your attention...",
          },
        ]),
      )
    }
    if (method === 'GET' && path === '/admin/settings/integrations') {
      return route.fulfill(
        ok([
          {
            service: 'anthropic',
            label: 'Anthropic (Claude API)',
            apiKey: 'sk-ant-api03-••••••••••••••••1234',
            isSet: true,
            lastValidatedAt: new Date().toISOString(),
            validationStatus: 'valid',
          },
          {
            service: 'openai',
            label: 'OpenAI (GPT-4o fallback)',
            apiKey: 'sk-proj-••••••••••••••••5678',
            isSet: true,
            lastValidatedAt: new Date().toISOString(),
            validationStatus: 'valid',
          },
          {
            service: 'stripe',
            label: 'Stripe (Billing)',
            apiKey: 'sk_live_••••••••••••••••9012',
            isSet: true,
            lastValidatedAt: new Date().toISOString(),
            validationStatus: 'valid',
          },
          {
            service: 'github',
            label: 'GitHub (OAuth + CI/CD)',
            apiKey: 'ghp_••••••••••••••••3456',
            isSet: true,
            lastValidatedAt: null,
            validationStatus: 'unchecked',
          },
          {
            service: 'resend',
            label: 'Resend (Email)',
            apiKey: 're_••••••••••••7890',
            isSet: true,
            lastValidatedAt: new Date().toISOString(),
            validationStatus: 'valid',
          },
          {
            service: 'pinecone',
            label: 'Pinecone (Vector DB)',
            apiKey: '',
            isSet: false,
            lastValidatedAt: null,
            validationStatus: 'unchecked',
          },
        ]),
      )
    }
    if (method === 'GET' && path === '/admin/settings/feature-flags') {
      return route.fulfill(
        ok([
          {
            id: 'ff-1',
            key: 'design_mode',
            description: 'Enable Figma-style design canvas in Phase 3',
            enabled: true,
            rolloutPercent: 100,
            planRestriction: [],
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'ff-2',
            key: 'rag_ai',
            description:
              'Enable RAG document upload and retrieval for agents',
            enabled: true,
            rolloutPercent: 100,
            planRestriction: ['pro', 'enterprise'],
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'ff-3',
            key: 'growth_dashboard',
            description: 'Phase 6 growth analytics dashboard',
            enabled: true,
            rolloutPercent: 100,
            planRestriction: ['pro', 'enterprise'],
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'ff-4',
            key: 'ai_code_export',
            description: 'Export generated code as downloadable ZIP',
            enabled: true,
            rolloutPercent: 100,
            planRestriction: ['pro', 'enterprise'],
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'ff-5',
            key: 'multi_model_select',
            description: 'Let users choose between Claude and GPT-4o',
            enabled: false,
            rolloutPercent: 0,
            planRestriction: ['enterprise'],
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'ff-6',
            key: 'team_collaboration',
            description: 'Invite team members to a project (coming soon)',
            enabled: false,
            rolloutPercent: 0,
            planRestriction: [],
            updatedAt: new Date().toISOString(),
          },
        ]),
      )
    }
    if (method === 'GET' && path === '/admin/settings/security') {
      return route.fulfill(
        ok({
          force2FAForAdmins: true,
          sessionTimeoutMinutes: 60,
          ipAllowlist: ['203.0.113.0/24'],
          apiRateLimitPerMinute: 100,
          maxLoginAttempts: 3,
          lockoutDurationMinutes: 15,
        }),
      )
    }

    if (
      method === 'POST' &&
      path === '/admin/settings/security/invalidate-sessions'
    ) {
      return route.fulfill(ok({ sessionsInvalidated: 4 }))
    }

    if (method === 'POST' && path === '/admin/settings/email/test') {
      return route.fulfill(ok({ sent: true }))
    }

    if (method === 'POST' && path === '/admin/settings/logo') {
      return route.fulfill(ok({ logoUrl: 'https://cdn.example.com/logo.png' }))
    }

    if (
      (method === 'POST' || method === 'PATCH') &&
      path.startsWith('/admin/')
    ) {
      return route.fulfill(ok({}))
    }

    return route.continue()
  })

  await installAdminApiMocks(page)
}
