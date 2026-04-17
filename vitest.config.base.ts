import { defineConfig } from "vitest/config";

export const baseConfig = defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/tests/**",
        "**/*.d.ts",
        "**/*.config.{ts,js}",
        "**/coverage/**",
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});

export default baseConfig;
