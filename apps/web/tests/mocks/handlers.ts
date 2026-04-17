import { http, HttpResponse } from 'msw'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

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
  http.patch(`${API_BASE}/users/profile`, async () => HttpResponse.json({ data: { updated: true } })),
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
  http.post(`${API_BASE}/ai/runs`, async () =>
    HttpResponse.json({
      data: {
        runId: 'run-test-1',
        streamUrl: '/ai/runs/run-test-1/stream',
        status: 'running',
      },
    }),
  ),
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
  http.post(`${API_BASE}/ai/runs/run-test-1/cancel`, async () => HttpResponse.json({ data: { status: 'cancelled' } })),
  http.post(`${API_BASE}/projects/:id/copilot-preferences`, async () => HttpResponse.json({ data: { saved: true } })),
  http.get(`${API_BASE}/rag/namespace`, async () =>
    HttpResponse.json({
      data: {
        namespace: 'user_test',
        docCount: 2,
        docLimit: 5,
        status: 'active',
        lastIndexedAt: new Date().toISOString(),
      },
    }),
  ),
  http.post(`${API_BASE}/billing/checkout`, async () =>
    HttpResponse.json({ data: { checkoutUrl: 'https://checkout.stripe.com/test' } }),
  ),
]
