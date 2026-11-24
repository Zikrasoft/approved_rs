import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30_000,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: [
      fileURLToPath(
        import.meta.resolve('@podbor/lead-crm/testing/database-server'),
      ),
    ],
    setupFiles: ['@podbor/lead-crm/testing/database'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: { statements: 100, functions: 100, lines: 100, branches: 90 },
    },
  },
});
