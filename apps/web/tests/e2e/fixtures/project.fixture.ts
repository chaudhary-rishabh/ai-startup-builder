import type { BrowserContext, Page } from '@playwright/test'

export const projectFixture = {
  async createInPhase1(_page: Page, _context: BrowserContext): Promise<string> {
    return 'proj-1'
  },
  async createWithPhase1Complete(_page: Page): Promise<{ projectId: string; output: Record<string, unknown> }> {
    return {
      projectId: 'proj-1',
      output: {
        ideaAnalysis: {
          problemStatement: 'Restaurants waste 30% of inventory weekly',
          solution: 'AI-powered inventory prediction',
          icp: 'Independent restaurant owners',
        },
      },
    }
  },
}
