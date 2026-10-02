import { createTelegramClient } from '@podbor/lead-crm';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[telegram] ${name} is not set`);
  return value;
}

export const CAPTURE_WEBHOOK_SECRET =
  process.env.TELEGRAM_CAPTURE_WEBHOOK_SECRET;

export const captureClient = createTelegramClient(
  requireEnv('TELEGRAM_CAPTURE_BOT_TOKEN'),
);
