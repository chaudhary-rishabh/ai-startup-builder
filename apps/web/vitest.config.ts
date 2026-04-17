import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    css: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'store/authStore.ts',
        'store/uiStore.ts',
        'store/projectStore.ts',
        'hooks/useProjects.ts',
        'hooks/useAgentStream.ts',
        'hooks/usePhaseAdvance.ts',
        'components/common/TokenBudgetBanner.tsx',
        'components/phases/DocModeIndicator.tsx',
        'components/phases/CrossCheckBadge.tsx',
        'components/phases/phase1/ValidationScoreCircle.tsx',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
