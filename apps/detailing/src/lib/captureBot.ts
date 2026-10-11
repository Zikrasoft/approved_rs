import { captureWebhookSecret } from '@podbor/lead-capture';
import { createTelegramClient, requireEnv } from '@podbor/lead-crm';
import { BRAND } from '@/utils/constants';

export const CAPTURE_WEBHOOK_SECRET = captureWebhookSecret(process.env);

export const captureBot = createTelegramClient(
  requireEnv('TELEGRAM_CAPTURE_BOT_TOKEN'),
  BRAND.captureBot,
).bot;
