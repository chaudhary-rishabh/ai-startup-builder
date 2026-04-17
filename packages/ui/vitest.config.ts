import path from 'path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

import { baseConfig } from '../../vitest.config.base'

export default defineConfig({
  plugins: [react()],

  test: {
    // Spread base thresholds, timeout, coverage reporters from root config
    ...baseConfig.test,

    // Override: React components need a browser-like DOM environment
    environment: 'jsdom',

    // Override: use this package's own setup file
    setupFiles: ['./tests/setup.ts'],

    globals: true,

    coverage: {
      ...baseConfig.test?.coverage,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/**',
        '**/*.d.ts',
        '**/*.config.{ts,js}',
        '**/coverage/**',
        '**/*.stories.tsx',
        '**/stories/**',
        '**/.storybook/**',
        '**/styles/**',
        // Barrel file — re-exports only, not testable business logic
        'src/index.ts',
        // Radix UI wrappers — thin pass-throughs, no custom logic to test
        'src/components/shadcn/**',
      ],
    },
  },

  resolve: {
    alias: {
      '@repo/ui': path.resolve(__dirname, './src/index.ts'),
    },
  },
})
