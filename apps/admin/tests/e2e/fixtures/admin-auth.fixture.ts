import { test as base, type Page } from '@playwright/test'

interface AdminFixtures {
  adminPage: Page
}

export const test = base.extend<AdminFixtures>({
  adminPage: async ({ page, context }, use) => {
    await context.addCookies([
      {
        name: 'admin_token',
        value:
          'mock.eyJzdWIiOiJhZG1pbi0xIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsIm5hbWUiOiJTdXBlciBBZG1pbiIsInJvbGUiOiJzdXBlcl9hZG1pbiIsImlhdCI6MTcwNTMxMjIwMCwiZXhwIjo5OTk5OTk5OTk5fQ.signature',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      },
    ])
    await page.goto('http://localhost:3001/admin/login')
    await page.evaluate(() => {
      localStorage.setItem(
        'admin-auth-store',
        JSON.stringify({
          state: {
            admin: {
              id: 'admin-1',
              email: 'admin@example.com',
              name: 'Super Admin',
              role: 'super_admin',
              avatarUrl: null,
              lastLoginAt: null,
            },
            isAuthenticated: true,
          },
          version: 0,
        }),
      )
    })
    await use(page)
  },
})

export { expect } from '@playwright/test'
