import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_CHANNEL_ID: '-1001234567890',
      TELEGRAM_GROUP_ID: '-1009876543210',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
    },
  },
});
