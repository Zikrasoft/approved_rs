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
      PUBLIC_PHONE_NUMBER: '381677210533',
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_GROUP_ID: '-1009876543210',
      TELEGRAM_OWNER_ID: '111',
      TELEGRAM_ADMIN_ID: '222',
      TELEGRAM_BOT_USERNAME: 'details_test_bot',
      TELEGRAM_CAPTURE_BOT_TOKEN: 'test-capture-bot-token',
      TELEGRAM_CAPTURE_WEBHOOK_SECRET: 'test-capture-webhook-secret',
    },
  },
});
