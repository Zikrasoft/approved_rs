import { APPROVED, CARLAB, DETAILS } from '@podbor/brands';
import { createCaptureBot } from '@podbor/lead-capture';
import {
  createTelegramClient,
  requireEnv,
  type TelegramClient,
} from '@podbor/lead-crm';
import { z } from 'zod';

export const CAPTURE_WEBHOOK_SECRET =
  process.env.TELEGRAM_CAPTURE_WEBHOOK_SECRET;

const captureToken = requireEnv('TELEGRAM_CAPTURE_BOT_TOKEN');

export const captureClient = createTelegramClient(captureToken);

export const captureBot = createCaptureBot(captureToken, APPROVED.captureBot);

const optionalToken = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const siblingTokensSchema = z.object({
  TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB: optionalToken,
  TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS: optionalToken,
});

export function siblingTokens(
  env: Record<string, unknown>,
): ReadonlyMap<string, string> {
  const parsed = siblingTokensSchema.parse(env);
  const tokens = new Map<string, string>();
  if (parsed.TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB)
    tokens.set(CARLAB.name, parsed.TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB);
  if (parsed.TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS)
    tokens.set(DETAILS.name, parsed.TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS);
  return tokens;
}

const clients = new Map<string, TelegramClient>([
  [APPROVED.name, captureClient],
]);
for (const [brand, token] of siblingTokens(process.env))
  clients.set(brand, createTelegramClient(token));

export const captureClientFor = (brand: string): TelegramClient | undefined =>
  clients.get(brand);

export const REPLY_RELAY_BRANDS: readonly string[] = [...clients.keys()];
