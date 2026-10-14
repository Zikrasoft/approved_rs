import { captureWebhookSecret } from '@podbor/lead-capture';
import { waitUntil } from '@vercel/functions';
import {
  createMetaLeadReporter,
  createTelegramClient,
  requireEnv,
} from '@podbor/lead-crm';
import { BRAND } from '@/utils/constants';
import { META_PIXEL_ID } from '@/utils/analytics';

export const CAPTURE_WEBHOOK_SECRET = captureWebhookSecret(process.env);

export const captureBot = createTelegramClient(
  requireEnv('TELEGRAM_CAPTURE_BOT_TOKEN'),
  BRAND.captureBot,
).bot;

export const reportMetaLead = createMetaLeadReporter({
  pixelId: META_PIXEL_ID,
  env: process.env,
  waitUntil,
});
