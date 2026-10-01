import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.FUNNEL_PORT ?? 4322);
const BASE_URL = `http://localhost:${PORT}`;

const REQUIRED = [
  'PUBLIC_MEDUSA_BACKEND_URL',
  'PUBLIC_MEDUSA_PUBLISHABLE_KEY',
  'SHOP_ORDER_HOOK_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_GROUP_ID',
  'TELEGRAM_BOT_USERNAME',
] as const;

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(
    `The funnel walk needs ${missing.join(', ')} in the shell. See funnel/README.md.`,
  );
}

const STUB = new URL('./funnel/telegramStub.ts', import.meta.url).href;

export default defineConfig({
  testDir: './funnel',
  timeout: 180_000,
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  use: { baseURL: BASE_URL },
  webServer: {
    command: `pnpm exec astro dev --port ${PORT}`,
    url: `${BASE_URL}/ru/shop/`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ASTRO_DEV_BACKGROUND: '1',
      SHOP_STATUS: 'live',
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ${STUB}`.trim(),
    },
  },
});
