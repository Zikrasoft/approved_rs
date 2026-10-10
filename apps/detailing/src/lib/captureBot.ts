import { createTelegramClient, requireEnv } from '@podbor/lead-crm';
import { BRAND } from '@/utils/constants';

export const CAPTURE_WEBHOOK_SECRET =
  process.env.TELEGRAM_CAPTURE_WEBHOOK_SECRET;

export const captureBot = createTelegramClient(
  requireEnv('TELEGRAM_CAPTURE_BOT_TOKEN'),
  BRAND.captureBot,
).bot;
