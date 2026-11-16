import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/testing/databaseServer.ts'],
    setupFiles: ['src/testing/database.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/testing/index.ts',
        'src/testing/database*.ts',
        'src/generated/**',
      ],
      thresholds: { statements: 100, functions: 100, lines: 100, branches: 90 },
    },
  },
});
