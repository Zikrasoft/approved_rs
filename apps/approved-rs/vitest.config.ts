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
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    env: {
      PUBLIC_WHATSAPP_NUMBER: '381677702100',
      PUBLIC_VIBER_NUMBER: '381677702100',
      PUBLIC_THREADS_CHANNEL: 'approved_test',
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_CHANNEL_ID: '-1001234567890',
      TELEGRAM_GROUP_ID: '-1009876543210',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      TELEGRAM_OWNER_ID: '111',
      TELEGRAM_ADMIN_ID: '222',
      TELEGRAM_BOT_USERNAME: 'approved_test_bot',
      TELEGRAM_CAPTURE_BOT_TOKEN: 'test-capture-bot-token',
      TELEGRAM_CAPTURE_WEBHOOK_SECRET: 'test-capture-webhook-secret',
      CRON_SECRET: 'test-cron-secret',
    },
  },
});
