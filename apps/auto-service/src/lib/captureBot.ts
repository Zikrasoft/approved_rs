import { captureWebhookSecret } from '@podbor/lead-capture';
import { APPROVED, DETAILS } from '@podbor/brands';
import {
  createMetaLeadReporter,
  createTelegramClient,
  requireEnv,
  type TelegramClient,
} from '@podbor/lead-crm';
import { z } from 'zod';
import { BRAND } from '@/utils/constants';
import { META_PIXEL_ID } from '@/utils/analytics';

export const CAPTURE_WEBHOOK_SECRET = captureWebhookSecret(process.env);

export const captureClient = createTelegramClient(
  requireEnv('TELEGRAM_CAPTURE_BOT_TOKEN'),
  BRAND.captureBot,
);

export const captureBot = captureClient.bot;

const optionalToken = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const siblingTokensSchema = z.object({
  TELEGRAM_CAPTURE_BOT_TOKEN_APPROVED: optionalToken,
  TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS: optionalToken,
});

export function siblingTokens(
  env: Record<string, unknown>,
): ReadonlyMap<typeof APPROVED | typeof DETAILS, string> {
  const parsed = siblingTokensSchema.parse(env);
  const tokens = new Map<typeof APPROVED | typeof DETAILS, string>();
  if (parsed.TELEGRAM_CAPTURE_BOT_TOKEN_APPROVED)
    tokens.set(APPROVED, parsed.TELEGRAM_CAPTURE_BOT_TOKEN_APPROVED);
  if (parsed.TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS)
    tokens.set(DETAILS, parsed.TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS);
  return tokens;
}

const clients = new Map<string, TelegramClient>([[BRAND.name, captureClient]]);
for (const [brand, token] of siblingTokens(process.env))
  clients.set(brand.name, createTelegramClient(token, brand.captureBot));

export const captureClientFor = (brand: string): TelegramClient | undefined =>
  clients.get(brand);

export const reportMetaLead = createMetaLeadReporter({
  pixelId: META_PIXEL_ID,
  env: process.env,
});
