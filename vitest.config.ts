import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_CHANNEL_ID: '-1001234567890',
      TELEGRAM_GROUP_ID: '-1009876543210',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      GOOGLE_SHEETS_WEBAPP_URL: 'https://script.google.com/macros/s/test/exec',
      GOOGLE_SHEETS_WEBAPP_SECRET: 'test-sheets-secret',
    },
  },
});
