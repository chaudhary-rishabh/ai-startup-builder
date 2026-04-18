import { http, HttpResponse } from 'msw'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

export const handlers = [
  http.post(`${BASE}/auth/admin/login`, async ({ request }) => {
    const body = (await request.json()) as Record<string, string>
    if (body['email'] === 'locked@admin.com') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Account locked',
            lockoutEndsAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          },
        },
        { status: 423 },
      )
    }
    if (body['password'] === 'wrongpassword') {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        },
        { status: 401 },
      )
    }
    return HttpResponse.json({
      success: true,
      data: { requiresTotp: true, tempToken: 'temp_token_abc123' },
    })
  }),

  http.post(`${BASE}/auth/admin/verify-totp`, async ({ request }) => {
    const body = (await request.json()) as Record<string, string>
    if (body['totpCode'] === '000000') {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'INVALID_TOTP', message: 'Invalid code — try again' },
        },
        { status: 401 },
      )
    }
    return HttpResponse.json({
      success: true,
      data: {
        admin: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Super Admin',
          role: 'super_admin',
          avatarUrl: null,
          lastLoginAt: new Date().toISOString(),
        },
      },
    })
  }),

  http.post(`${BASE}/auth/admin/logout`, () =>
    HttpResponse.json({ success: true, data: {} }),
  ),

  http.post(`${BASE}/auth/admin/refresh`, () =>
    HttpResponse.json({ success: true, data: { expiresIn: 900 } }),
  ),

  http.get(`${BASE}/admin/kpis`, () =>
    HttpResponse.json({
      success: true,
      data: {
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
      },
    }),
  ),

  http.get(`${BASE}/admin/revenue`, () =>
    HttpResponse.json({
      success: true,
      data: [
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
        {
          month: 'Mar 2025',
          mrr: 2040000,
          newMrr: 180000,
          churnedMrr: 60000,
        },
        {
          month: 'Apr 2025',
          mrr: 2160000,
          newMrr: 200000,
          churnedMrr: 80000,
        },
        {
          month: 'May 2025',
          mrr: 2280000,
          newMrr: 220000,
          churnedMrr: 100000,
        },
        {
          month: 'Jun 2025',
          mrr: 2480000,
          newMrr: 260000,
          churnedMrr: 60000,
        },
      ],
    }),
  ),

  http.get(`${BASE}/admin/user-growth`, () =>
    HttpResponse.json({
      success: true,
      data: [
        { week: 'Week of Mar 3', signups: 48, churned: 4 },
        { week: 'Week of Mar 10', signups: 71, churned: 6 },
        { week: 'Week of Mar 17', signups: 54, churned: 5 },
        { week: 'Week of Mar 24', signups: 89, churned: 8 },
        { week: 'Week of Mar 31', signups: 63, churned: 3 },
        { week: 'Week of Apr 7', signups: 95, churned: 9 },
      ],
    }),
  ),

  http.get(`${BASE}/admin/users/recent`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 'u-1',
          name: 'Priya Sharma',
          email: 'priya@startup.io',
          avatarUrl: null,
          plan: 'pro',
          signedUpAt: new Date().toISOString(),
          status: 'active',
        },
        {
          id: 'u-2',
          name: 'Marcus Chen',
          email: 'marcus@idea.co',
          avatarUrl: null,
          plan: 'free',
          signedUpAt: new Date().toISOString(),
          status: 'unverified',
        },
        {
          id: 'u-3',
          name: "Sarah O'Brien",
          email: 'sarah@builder.xyz',
          avatarUrl: null,
          plan: 'pro',
          signedUpAt: new Date().toISOString(),
          status: 'active',
        },
      ],
    }),
  ),

  http.get(`${BASE}/admin/activity`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 'ev-1',
          type: 'user.upgrade',
          actorName: 'Priya Sharma',
          actorAvatarUrl: null,
          description: 'Upgraded from Free to Pro',
          metadata: {},
          occurredAt: new Date().toISOString(),
        },
        {
          id: 'ev-2',
          type: 'payment.received',
          actorName: 'Marcus Chen',
          actorAvatarUrl: null,
          description: 'Payment received — $29.00',
          metadata: {},
          occurredAt: new Date().toISOString(),
        },
        {
          id: 'ev-3',
          type: 'project.created',
          actorName: "Sarah O'Brien",
          actorAvatarUrl: null,
          description: 'Created project "FoodieAI"',
          metadata: {},
          occurredAt: new Date().toISOString(),
        },
      ],
    }),
  ),
]
