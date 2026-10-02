import { createTelegramClient, requireEnv } from '@podbor/lead-crm';

export const CAPTURE_WEBHOOK_SECRET =
  process.env.TELEGRAM_CAPTURE_WEBHOOK_SECRET;

export const captureClient = createTelegramClient(
  requireEnv('TELEGRAM_CAPTURE_BOT_TOKEN'),
);
