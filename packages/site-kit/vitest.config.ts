import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    isolate: false,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/browser.ts'],
      thresholds: {
        statements: 100,
        functions: 100,
        lines: 100,
        branches: 100,
      },
    },
  },
});
