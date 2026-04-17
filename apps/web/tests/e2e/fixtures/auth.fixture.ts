import { test as base } from '@playwright/test'

type AuthFixture = {
  withAuthCookie: () => Promise<void>
}

export const test = base.extend<AuthFixture>({
  withAuthCookie: async ({ context }, use) => {
    await use(async () => {
      await context.addCookies([
        {
          name: 'access_token',
          value: 'e2e:onboardingDone=false',
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ])
    })
  },
})

export { expect } from '@playwright/test'
