import { defineConfig, devices } from '@playwright/test'
import { basePlaywrightConfig } from '../../playwright.config.base'

export default defineConfig({
  ...basePlaywrightConfig,
  testDir: './tests/e2e',
  use: {
    ...basePlaywrightConfig.use,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
