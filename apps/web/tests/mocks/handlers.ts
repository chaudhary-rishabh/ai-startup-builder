import { http, HttpResponse } from 'msw'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

function sseResponse(lines: string): HttpResponse<string> {
  return new HttpResponse<string>(lines, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}

let mockRagDocuments = [
  {
    id: 'doc-1',
    filename: 'business-plan.pdf',
    fileType: 'pdf' as const,
    fileSizeBytes: 1_048_576,
    status: 'indexed' as const,
    chunkCount: 48,
    source: 'upload' as const,
    customInstructions: null as string | null,
    createdAt: new Date().toISOString(),
    indexedAt: new Date().toISOString(),
  },
  {
    id: 'doc-2',
    filename: 'market-research.docx',
    fileType: 'docx' as const,
    fileSizeBytes: 524_288,
    status: 'processing' as const,
    chunkCount: 0,
    source: 'upload' as const,
    customInstructions: 'Focus on SaaS metrics',
    createdAt: new Date().toISOString(),
    indexedAt: null as string | null,
  },
]

export function resetMockRagDocuments(): void {
  mockRagDocuments = [
    {
      id: 'doc-1',
      filename: 'business-plan.pdf',
      fileType: 'pdf',
      fileSizeBytes: 1_048_576,
      status: 'indexed',
      chunkCount: 48,
      source: 'upload',
      customInstructions: null,
      createdAt: new Date().toISOString(),
      indexedAt: new Date().toISOString(),
    },
    {
      id: 'doc-2',
      filename: 'market-research.docx',
      fileType: 'docx',
      fileSizeBytes: 524_288,
      status: 'processing',
      chunkCount: 0,
      source: 'upload',
      customInstructions: 'Focus on SaaS metrics',
      createdAt: new Date().toISOString(),
      indexedAt: null,
    },
  ]
}

interface MockProjectFile {
  id: string
  projectId: string
  path: string
  content: string
  language: string
  agentType: string
  isModified: boolean
  createdAt: string
  updatedAt: string
}

const defaultMockProjectFiles: MockProjectFile[] = [
  {
    id: 'file-1',
    projectId: 'proj-1',
    path: '/src/schema/user.ts',
    content:
      'import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";\n\nexport const users = pgTable("users", {\n  id: uuid("id").primaryKey().defaultRandom(),\n  email: varchar("email", { length: 255 }).unique().notNull(),\n});\n',
    language: 'typescript',
    agentType: 'schema',
    isModified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'file-2',
    projectId: 'proj-1',
    path: '/src/routes/auth.ts',
    content: 'import { Hono } from "hono";\n\nconst app = new Hono();\n\napp.post("/login", async (c) => {\n  return c.json({ success: true });\n});\n\nexport default app;\n',
    language: 'typescript',
    agentType: 'backend',
    isModified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'file-env',
    projectId: 'proj-1',
    path: '/.env.example',
    content: 'DATABASE_URL=\nNEXTAUTH_SECRET=\n',
    language: 'plaintext',
    agentType: 'backend',
    isModified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

let mockProjectFiles: MockProjectFile[] = [...defaultMockProjectFiles]

export function resetMockProjectFiles(): void {
  mockProjectFiles = [...defaultMockProjectFiles]
}

export const handlers = [
  http.post(`${API_BASE}/auth/register`, async () =>
    HttpResponse.json({ data: { userId: 'test-id', message: 'Verification email sent' } }),
  ),
  http.post(`${API_BASE}/auth/verify-email`, async () => HttpResponse.json({ data: { verified: true } })),
  http.post(`${API_BASE}/auth/login`, async () =>
    HttpResponse.json({
      data: {
        user: { id: 'u1', email: 'test@example.com', name: 'Test User', role: 'user', plan: 'free' },
      },
    }),
  ),
  http.post(`${API_BASE}/auth/login/totp`, async () =>
    HttpResponse.json({
      data: {
        user: { id: 'u1', email: 'test@example.com', name: 'Test User', role: 'user', plan: 'free' },
      },
    }),
  ),
  http.post(`${API_BASE}/auth/logout`, async () => HttpResponse.json({ data: {} })),
  http.post(`${API_BASE}/auth/refresh`, async () => HttpResponse.json({ data: {} })),
  http.post(`${API_BASE}/auth/forgot-password`, async () => HttpResponse.json({ data: {} })),
  http.get(`${API_BASE}/auth/me`, async () =>
    HttpResponse.json({
      data: {
        id: 'u1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        plan: 'free',
        onboardingDone: true,
      },
    }),
  ),
  http.get(`${API_BASE}/billing/token-usage`, async () =>
    HttpResponse.json({
      data: {
        tokensUsed: 1000,
        tokensLimit: 50000,
        tokensRemaining: 49000,
        percentUsed: 2,
        planTier: 'free',
        currentMonth: '2026-04',
        resetAt: new Date().toISOString(),
        isUnlimited: false,
        warningThresholds: [
          { percent: 80, triggered: false },
          { percent: 95, triggered: false },
        ],
      },
    }),
  ),
  http.get(`${API_BASE}/billing/subscription`, async () =>
    HttpResponse.json({
      data: {
        planTier: 'pro',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        stripeCustomerId: 'cus_test123',
      },
    }),
  ),
  http.get(`${API_BASE}/billing/invoices`, async () =>
    HttpResponse.json({
      data: [
        {
          id: 'inv-1',
          amount: 2900,
          currency: 'usd',
          status: 'paid',
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
          invoiceUrl: 'https://stripe.com/invoices/test',
          createdAt: new Date().toISOString(),
        },
      ],
    }),
  ),
  http.get(`${API_BASE}/billing/plans`, async () =>
    HttpResponse.json({
      data: [
        {
          tier: 'free',
          name: 'Free',
          price: { monthly: 0, yearly: 0 },
          tokenLimit: 50000,
          projectLimit: 3,
          features: ['Phase 1 & 2 only', '3 projects', '50K tokens/month'],
        },
        {
          tier: 'pro',
          name: 'Pro',
          price: { monthly: 2900, yearly: 29000 },
          tokenLimit: 500000,
          projectLimit: 20,
          features: ['All 6 phases', '20 projects', '500K tokens/month', 'Code export'],
        },
      ],
    }),
  ),
  http.post(`${API_BASE}/billing/portal`, async () =>
    HttpResponse.json({ data: { portalUrl: 'https://billing.stripe.com/session/test' } }),
  ),
  http.delete(`${API_BASE}/billing/subscription`, async () => HttpResponse.json({ data: { cancelled: true } })),
  http.get(`${API_BASE}/users/me`, async () =>
    HttpResponse.json({
      data: {
        id: 'user-1',
        name: 'Alex Founder',
        email: 'alex@example.com',
        avatarUrl: null,
        role: 'FOUNDER',
        bio: 'Building the future',
        company: 'TechCo',
        website: 'https://techco.com',
        timezone: 'America/New_York',
      },
    }),
  ),
  http.patch(`${API_BASE}/users/profile`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      data: {
        id: 'user-1',
        name: String(body.name ?? 'Alex Founder'),
        email: 'alex@example.com',
        avatarUrl: body.avatarUrl === undefined ? null : (body.avatarUrl as string | null),
        role: String(body.role ?? 'FOUNDER'),
        bio: body.bio === undefined ? 'Building the future' : (body.bio as string | null),
        company: body.company === undefined ? 'TechCo' : (body.company as string | null),
        website: body.website === undefined ? 'https://techco.com' : (body.website as string | null),
        timezone: String(body.timezone ?? 'America/New_York'),
      },
    })
  }),
  http.post(`${API_BASE}/users/avatar`, async () =>
    HttpResponse.json({ data: { avatarUrl: 'https://cdn.example.com/avatar.png' } }),
  ),
  http.get(`${API_BASE}/users/notification-preferences`, async () =>
    HttpResponse.json({
      data: {
        emailEnabled: true,
        inAppEnabled: true,
        phaseComplete: true,
        agentDone: true,
        billingEvents: true,
        weeklyDigest: true,
        securityAlerts: true,
      },
    }),
  ),
  http.patch(`${API_BASE}/users/notification-preferences`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      data: {
        emailEnabled: Boolean(body.emailEnabled ?? true),
        inAppEnabled: Boolean(body.inAppEnabled ?? true),
        phaseComplete: Boolean(body.phaseComplete ?? true),
        agentDone: Boolean(body.agentDone ?? true),
        billingEvents: Boolean(body.billingEvents ?? true),
        weeklyDigest: Boolean(body.weeklyDigest ?? true),
        securityAlerts: true,
      },
    })
  }),
  http.get(`${API_BASE}/users/api-keys`, async () =>
    HttpResponse.json({
      data: [
        {
          id: 'key-1',
          prefix: 'ask_1234',
          name: 'My Dev Key',
          lastUsedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
    }),
  ),
  http.post(`${API_BASE}/users/api-keys`, async () =>
    HttpResponse.json({
      data: {
        id: 'key-new',
        prefix: 'ask_9999',
        secret: 'ask_9999xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        name: 'Test Key',
      },
    }),
  ),
  http.delete(`${API_BASE}/users/api-keys/:id`, async () => HttpResponse.json({ data: { revoked: true } })),
  http.get(`${API_BASE}/projects`, async () =>
    HttpResponse.json({
      data: {
        projects: [
          {
            id: 'proj-1',
            userId: 'u1',
            name: 'RestaurantIQ',
            emoji: '🍽️',
            description: 'AI restaurant inventory',
            currentPhase: 2,
            status: 'active',
            isStarred: true,
            mode: 'design',
            buildMode: 'copilot',
            phaseProgress: { '1': 'complete', '2': 'active' },
            lastActiveAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          {
            id: 'proj-2',
            userId: 'u1',
            name: 'HealthAI Coach',
            emoji: '🏥',
            description: 'Fitness coaching app',
            currentPhase: 1,
            status: 'active',
            isStarred: false,
            mode: 'design',
            buildMode: 'autopilot',
            phaseProgress: { '1': 'active' },
            lastActiveAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
        total: 2,
        page: 1,
        limit: 20,
      },
    }),
  ),
  http.get(`${API_BASE}/projects/:id`, async ({ params }) =>
    HttpResponse.json({
      data: {
        id: String(params.id),
        userId: 'u1',
        name: 'RestaurantIQ',
        emoji: '🍽️',
        description: 'AI restaurant inventory',
        currentPhase: 2,
        status: 'active',
        isStarred: true,
        mode: 'design',
        buildMode: 'copilot',
        phaseProgress: { '1': 'complete', '2': 'active' },
        copilotPreferences: {
          scale: 'Small SaaS',
          platform: 'Web',
          architecture: 'Serverless',
          brandFeel: 'Professional',
        },
        phase2Output: {
          prd: {
            features: [
              {
                id: 'f1',
                name: 'User Authentication',
                priority: 'Must',
                description: 'Secure login and registration with OAuth support',
                acceptanceCriteria: ['Users can sign up with email', 'Google OAuth works'],
              },
              {
                id: 'f2',
                name: 'Inventory Dashboard',
                priority: 'Must',
                description: 'Real-time view of all inventory items',
              },
              {
                id: 'f3',
                name: 'Analytics Export',
                priority: 'Should',
                description: 'Export inventory reports to CSV',
              },
            ],
            userStories: [
              {
                id: 'us1',
                role: 'restaurant owner',
                want: 'see my inventory levels in real-time',
                soThat: 'I can prevent stock-outs before they happen',
                featureId: 'f2',
              },
            ],
          },
          userFlow: {
            flowSteps: [
              { id: 's1', type: 'start', label: 'Start' },
              { id: 's2', type: 'action', label: 'Open Dashboard', isDropOffRisk: true },
              { id: 's3', type: 'decision', label: 'Stock low?' },
              { id: 's4', type: 'result', label: 'Create reorder alert' },
              { id: 's5', type: 'end', label: 'End' },
            ],
            dropOffPoints: ['Open Dashboard'],
          },
          systemDesign: {
            techStack: [
              {
                category: 'frontend',
                name: 'Next.js 15',
                reasoning: 'App Router, RSC, Vercel deployment',
                docsUrl: 'https://nextjs.org',
              },
              {
                category: 'backend',
                name: 'Hono + TypeScript',
                reasoning: 'Edge-compatible, lightweight, typed API',
                docsUrl: 'https://hono.dev',
              },
              {
                category: 'database',
                name: 'PostgreSQL + Drizzle',
                reasoning: 'Type-safe ORM, relational for inventory data',
              },
            ],
            apiEndpoints: [
              { method: 'GET', route: '/api/inventory', description: 'List all inventory items' },
              { method: 'POST', route: '/api/inventory', description: 'Create new inventory item' },
              { method: 'PATCH', route: '/api/inventory/:id', description: 'Update item quantity' },
              { method: 'DELETE', route: '/api/inventory/:id', description: 'Remove item from inventory' },
            ],
          },
          uiux: {
            wireframes: [
              {
                id: 'ws1',
                name: 'Dashboard',
                blocks: [
                  { type: 'nav', label: 'Navigation', height: 36 },
                  { type: 'hero', label: 'Hero', height: 48 },
                  { type: 'content', label: 'Inventory Cards', height: 70 },
                ],
              },
            ],
            designSystem: {
              primaryColor: '#7C3AED',
              backgroundColor: '#F8F5FF',
              fontFamily: 'Inter',
              borderRadius: '8px',
              spacing: '4px',
            },
            componentList: ['TopBar', 'InventoryCard'],
          },
        },
        lastActiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    }),
  ),
  http.post(`${API_BASE}/projects`, async () =>
    HttpResponse.json(
      {
        data: {
          id: 'proj-new',
          userId: 'u1',
          name: 'New Project',
          emoji: '🚀',
          description: null,
          currentPhase: 1,
          status: 'active',
          isStarred: false,
          mode: 'design',
          buildMode: 'copilot',
          phaseProgress: { '1': 'active' },
          lastActiveAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    ),
  ),
  http.patch(`${API_BASE}/projects/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      data: {
        id: String(params.id),
        userId: 'u1',
        name: String(body.name ?? 'RestaurantIQ'),
        emoji: String(body.emoji ?? '🍽️'),
        description: body.description ?? 'AI restaurant inventory',
        currentPhase: 2,
        status: String(body.status ?? 'active'),
        isStarred: Boolean(body.isStarred ?? true),
        mode: 'design',
        buildMode: 'copilot',
        phaseProgress: { '1': 'complete', '2': 'active' },
        lastActiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    })
  }),
  http.delete(`${API_BASE}/projects/:id`, async () => HttpResponse.json({ data: { message: 'Project deleted' } })),
  http.post(`${API_BASE}/projects/:id/duplicate`, async ({ params }) =>
    HttpResponse.json({
      data: {
        id: `${params.id}-copy`,
        userId: 'u1',
        name: 'RestaurantIQ Copy',
        emoji: '🍽️',
        description: 'AI restaurant inventory',
        currentPhase: 1,
        status: 'active',
        isStarred: false,
        mode: 'design',
        buildMode: 'copilot',
        phaseProgress: { '1': 'active' },
        lastActiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    }),
  ),
  http.post(`${API_BASE}/projects/:id/advance-phase`, async ({ request }) => {
    const body = (await request.json()) as { targetPhase?: number }
    return HttpResponse.json({
      data: {
        previousPhase: (body.targetPhase ?? 2) - 1,
        currentPhase: body.targetPhase ?? 2,
      },
    })
  }),
  http.post(`${API_BASE}/ai/runs`, async ({ request }) => {
    const body = (await request.json()) as { agentType?: string }
    const agent = body.agentType ?? ''
    const runMap: Record<string, string> = {
      schema_gen: 'run-schema-1',
      testing: 'run-testing-1',
      cicd: 'run-cicd-1',
      deploy: 'run-deploy-1',
      analytics_agent: 'run-analytics-1',
      feedback: 'run-feedback-1',
      growth: 'run-growth-1',
    }
    const runId = runMap[agent] ?? 'run-test-1'
    return HttpResponse.json({
      data: {
        runId,
        streamUrl: `/ai/runs/${runId}/stream`,
        status: 'running',
      },
    })
  }),
  http.get(`${API_BASE}/ai/runs/:runId/stream`, ({ params }) => {
    const runId = String(params.runId)
    const testResults = {
      passed: 3,
      failed: 0,
      skipped: 1,
      suites: [
        {
          name: 'Unit Tests',
          tests: [
            { name: 'sanity', status: 'passed', durationMs: 12 },
            { name: 'auth', status: 'passed', durationMs: 34 },
          ],
        },
        {
          name: 'Integration Tests',
          tests: [{ name: 'api health', status: 'passed', durationMs: 120 }],
        },
        {
          name: 'E2E Tests',
          tests: [{ name: 'smoke', status: 'skipped', durationMs: 0 }],
        },
      ],
    }
    if (runId === 'run-testing-1') {
      const lines = [
        `event: token\ndata: ${JSON.stringify({ type: 'token', token: '>> tests starting\n', runId })}\n\n`,
        `event: done\ndata: ${JSON.stringify({ runId, tokensUsed: 1200, durationMs: 400, output: { testResults } })}\n\n`,
      ]
      return sseResponse(lines.join(''))
    }
    if (runId === 'run-cicd-1') {
      const yaml = 'name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n'
      const lines = [
        `event: token\ndata: ${JSON.stringify({ type: 'token', token: yaml, runId })}\n\n`,
        `event: done\ndata: ${JSON.stringify({ runId, tokensUsed: 800, durationMs: 300, output: { cicdYaml: yaml } })}\n\n`,
      ]
      return sseResponse(lines.join(''))
    }
    if (runId === 'run-deploy-1') {
      const lines = [
        `event: token\ndata: ${JSON.stringify({ type: 'token', token: '→ Deploy pipeline starting\n', runId })}\n\n`,
        `event: token\ndata: ${JSON.stringify({ type: 'token', token: '✓ SUCCESS build complete\n', runId })}\n\n`,
        `event: done\ndata: ${JSON.stringify({
          runId,
          tokensUsed: 500,
          durationMs: 200,
          output: { deployOutput: { liveUrl: 'https://my-app.vercel.app' } },
        })}\n\n`,
      ]
      return sseResponse(lines.join(''))
    }
    if (runId === 'run-analytics-1') {
      const output = {
        kpis: { activeUsers: 1240, retentionRate: 0.76, churnPercent: 0.042, mrr: 1240 },
        funnelDef: {
          steps: [
            { name: 'Acquisition', users: 10000, conversionRate: 100, dropOffRate: 40 },
            { name: 'Activation', users: 6000, conversionRate: 60, dropOffRate: 35 },
            { name: 'Retention', users: 3900, conversionRate: 65, dropOffRate: 30 },
            { name: 'Revenue', users: 1200, conversionRate: 31, dropOffRate: 0 },
          ],
        },
      }
      const lines = [
        `event: done\ndata: ${JSON.stringify({ runId, tokensUsed: 900, durationMs: 250, output })}\n\n`,
      ]
      return sseResponse(lines.join(''))
    }
    if (runId === 'run-feedback-1') {
      const output = {
        sentimentByEntry: [
          {
            id: 'f1',
            text: 'Love the onboarding flow, very smooth experience for our team.',
            sentiment: 'positive',
            category: 'General',
            frequency: 3,
          },
        ],
      }
      const lines = [`event: done\ndata: ${JSON.stringify({ runId, tokensUsed: 600, durationMs: 180, output })}\n\n`]
      return sseResponse(lines.join(''))
    }
    if (runId === 'run-growth-1') {
      const output = {
        marketingChannels: [
          { id: 'm1', title: 'Publish SEO pillar pages', channel: 'SEO', effort: 'low' },
          { id: 'm2', title: 'Founder-led LinkedIn', channel: 'Social', effort: 'medium' },
        ],
        firstHundredSteps: ['Ship MVP to 10 partners', 'Run weekly user interviews', 'Launch waitlist landing page'],
      }
      const lines = [`event: done\ndata: ${JSON.stringify({ runId, tokensUsed: 700, durationMs: 220, output })}\n\n`]
      return sseResponse(lines.join(''))
    }
    if (runId === 'run-schema-1') {
      const lines = [
        `event: batch_start\ndata: ${JSON.stringify({ type: 'batch_start', batchNumber: 1, totalBatches: 1, agentType: 'schema_gen', fileCount: 1, runId })}\n\n`,
        `event: done\ndata: ${JSON.stringify({ runId, tokensUsed: 100, durationMs: 50, output: { filesGenerated: 1, agentType: 'schema_gen' } })}\n\n`,
      ]
      return sseResponse(lines.join(''))
    }
    const lines = [`event: done\ndata: ${JSON.stringify({ runId, tokensUsed: 10, durationMs: 10, output: {} })}\n\n`]
    return sseResponse(lines.join(''))
  }),
  http.get(`${API_BASE}/ai/runs/run-test-1`, async () =>
    HttpResponse.json({
      data: {
        runId: 'run-test-1',
        projectId: 'proj-1',
        phase: 1,
        agentType: 'idea_analyzer',
        model: 'gpt',
        status: 'completed',
        tokensUsed: 1842,
        durationMs: 8240,
        output: {
          problemStatement: 'Restaurants waste 30% of inventory weekly',
          solution: 'AI-powered inventory prediction',
          icp: 'Independent restaurant owners, 20-50 seats',
        },
        createdAt: new Date().toISOString(),
      },
    }),
  ),
  http.post(`${API_BASE}/ai/runs/:runId/cancel`, async () => HttpResponse.json({ data: { status: 'cancelled' } })),
  http.post(`${API_BASE}/projects/:id/copilot-preferences`, async () => HttpResponse.json({ data: { saved: true } })),
  http.patch(`${API_BASE}/projects/:id/phase-data/:phase`, async () =>
    HttpResponse.json({ data: { saved: true } }),
  ),
  http.post(`${API_BASE}/ai/chat`, async () =>
    HttpResponse.json({
      data: {
        content: "I'd recommend adding a payment feature as a Must Have...",
        tokensUsed: 420,
      },
    }),
  ),
  http.post(`${API_BASE}/projects/:id/export`, async ({ params, request }) => {
    let body: { format?: string; phase?: number; includePhases?: number[] } = {}
    try {
      body = (await request.json()) as { format?: string; phase?: number; includePhases?: number[] }
    } catch {
      body = {}
    }
    if (body.format === 'zip' && body.phase === 4) {
      return new HttpResponse(new Blob([new Uint8Array([80, 75, 3, 4])], { type: 'application/zip' }), { status: 200 })
    }
    const now = new Date().toISOString()
    return HttpResponse.json({
      data: {
        jobId: 'job-1',
        status: 'processing',
        format: body.format ?? 'docx',
        downloadUrl: null,
        createdAt: now,
        completedAt: null,
      },
    })
  }),
  http.get(`${API_BASE}/projects/:id/export/:jobId`, async ({ params }) =>
    HttpResponse.json({
      data: {
        jobId: String(params.jobId),
        status: 'complete',
        format: 'docx',
        downloadUrl: 'https://s3.amazonaws.com/exports/test-export.docx',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    }),
  ),
  http.get(`${API_BASE}/projects/:id/files`, async ({ params }) =>
    HttpResponse.json({
      data: mockProjectFiles.filter((f) => f.projectId === String(params.id)),
    }),
  ),
  http.get(`${API_BASE}/projects/:id/files/:fileId`, async ({ params }) => {
    const file = mockProjectFiles.find((f) => f.id === String(params.fileId))
    if (!file) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json({ data: file })
  }),
  http.patch(`${API_BASE}/projects/:id/files/:fileId`, async ({ params, request }) => {
    const body = (await request.json()) as { content?: string }
    const idx = mockProjectFiles.findIndex((f) => f.id === String(params.fileId))
    if (idx < 0) return new HttpResponse(null, { status: 404 })
    const now = new Date().toISOString()
    mockProjectFiles[idx] = {
      ...mockProjectFiles[idx]!,
      content: body.content ?? mockProjectFiles[idx]!.content,
      isModified: true,
      updatedAt: now,
    }
    return HttpResponse.json({ data: mockProjectFiles[idx] })
  }),
  http.post(`${API_BASE}/projects/:id/files`, async ({ params, request }) => {
    const body = (await request.json()) as { path: string; content: string; language: string }
    const path = body.path.startsWith('/') ? body.path : `/${body.path}`
    const file: MockProjectFile = {
      id: `file-new-${mockProjectFiles.length}`,
      projectId: String(params.id),
      path,
      content: body.content,
      language: body.language,
      agentType: 'schema',
      isModified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockProjectFiles.push(file)
    return HttpResponse.json({ data: file }, { status: 201 })
  }),
  http.delete(`${API_BASE}/projects/:id/files/:fileId`, async ({ params }) => {
    mockProjectFiles = mockProjectFiles.filter((f) => f.id !== String(params.fileId))
    return HttpResponse.json({ data: { deleted: true } })
  }),
  http.get(`${API_BASE}/projects/:id/generation-plan`, async () =>
    HttpResponse.json({
      data: {
        totalFiles: 32,
        totalBatches: 6,
        estimatedMs: 28000,
        fileList: [
          '/src/schema/user.ts',
          '/src/schema/project.ts',
          '/src/routes/auth.ts',
          '/src/routes/projects.ts',
          '/src/controllers/auth.ts',
          '/src/controllers/projects.ts',
          '/src/middleware/auth.ts',
          '/.env.example',
          '/package.json',
        ],
        agentBreakdown: [
          { agentType: 'schema', fileCount: 4 },
          { agentType: 'api', fileCount: 6 },
          { agentType: 'backend', fileCount: 14 },
          { agentType: 'frontend', fileCount: 6 },
          { agentType: 'integration', fileCount: 2 },
        ],
      },
    }),
  ),
  http.get(`${API_BASE}/rag/documents`, async () => HttpResponse.json({ data: mockRagDocuments })),
  http.post(`${API_BASE}/rag/documents`, async () =>
    HttpResponse.json({ data: { docId: 'doc-new', status: 'processing', estimatedMs: 15000 } }),
  ),
  http.post(`${API_BASE}/rag/ingest-url`, async () =>
    HttpResponse.json({ data: { docId: 'doc-url-1', status: 'processing' } }),
  ),
  http.delete(`${API_BASE}/rag/documents/:docId`, async ({ params }) => {
    mockRagDocuments = mockRagDocuments.filter((d) => d.id !== String(params.docId))
    return HttpResponse.json({ data: { deleted: true } })
  }),
  http.delete(`${API_BASE}/rag/namespace`, async () => {
    mockRagDocuments = []
    return HttpResponse.json({ data: { deleted: true, documentsRemoved: 2 } })
  }),
  http.get(`${API_BASE}/rag/namespace`, async () =>
    HttpResponse.json({
      data: {
        namespace: 'user_test',
        docCount: mockRagDocuments.length,
        docLimit: 5,
        chunkCount: 120,
        chunkLimit: 500_000,
        docUsagePercent: Math.min(100, (mockRagDocuments.length / 5) * 100),
        status: mockRagDocuments.length ? 'active' : 'empty',
        lastIndexedAt: mockRagDocuments.length ? new Date().toISOString() : null,
      },
    }),
  ),
  http.post(`${API_BASE}/billing/checkout`, async () =>
    HttpResponse.json({ data: { checkoutUrl: 'https://checkout.stripe.com/test' } }),
  ),
]
