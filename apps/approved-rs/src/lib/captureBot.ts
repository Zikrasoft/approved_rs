import { APPROVED, CARLAB, DETAILS } from '@podbor/brands';
import {
  createTelegramClient,
  requireEnv,
  type TelegramClient,
} from '@podbor/lead-crm';
import { z } from 'zod';

export const CAPTURE_WEBHOOK_SECRET =
  process.env.TELEGRAM_CAPTURE_WEBHOOK_SECRET;

export const captureClient = createTelegramClient(
  requireEnv('TELEGRAM_CAPTURE_BOT_TOKEN'),
);

const optionalToken = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const siblingTokens = z
  .object({
    TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB: optionalToken,
    TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS: optionalToken,
  })
  .parse(process.env);

const clients = new Map<string, TelegramClient>([
  [APPROVED.name, captureClient],
]);

const addSibling = (brand: string, token: string | undefined): void => {
  if (token) clients.set(brand, createTelegramClient(token));
};

addSibling(CARLAB.name, siblingTokens.TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB);
addSibling(DETAILS.name, siblingTokens.TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS);

export const captureClientFor = (brand: string): TelegramClient | undefined =>
  clients.get(brand);

export const REPLY_RELAY_BRANDS: readonly string[] = [...clients.keys()];
