import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';
import { defineConfig, mergeConfig } from 'vitest/config';

const astro = getViteConfig({}, { configFile: false, logLevel: 'silent' });

export default defineConfig(async (env) =>
  mergeConfig(await astro(env), {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      coverage: { provider: 'v8', include: ['src/**/*.{ts,astro}'] },
      env: {
        PUBLIC_PHONE_NUMBER: '381677210533',
        PUBLIC_TG_MANAGER: 'carlabrs',
        TELEGRAM_BOT_TOKEN: '1001:test-bot-token',
        TELEGRAM_GROUP_ID: '-1009876543210',
        TELEGRAM_OWNER_ID: '111',
        TELEGRAM_ADMIN_ID: '222',
        TELEGRAM_BOT_USERNAME: 'carlab_test_bot',
        TELEGRAM_CAPTURE_BOT_TOKEN: '1002:test-capture-bot-token',
        TELEGRAM_CAPTURE_WEBHOOK_SECRET: 'test-capture-webhook-secret',
        META_CAPI_TOKEN: 'test-capi-token',
      },
    },
  }),
);
