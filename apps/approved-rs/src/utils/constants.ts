import { APPROVED } from '@podbor/brands';
import { telegramBotLink } from '@podbor/site-kit/contact-links';
import { z } from 'zod';
import type { Locale } from '@/i18n/config';

export const YM_COUNTER_ID = 111800377;

export const BRAND = APPROVED;

const publicEnvSchema = z.object({
  SITE: z.string().min(1).default(BRAND.url),
  PUBLIC_WHATSAPP_NUMBER: z.string().min(1),
  PUBLIC_VIBER_NUMBER: z.string().min(1),
  PUBLIC_THREADS_CHANNEL: z.string().min(1),
  PUBLIC_TG_MANAGER: z.string().min(1).optional(),
});

export function readPublicEnv(env: Record<string, unknown>) {
  return publicEnvSchema.parse(env);
}

const env = readPublicEnv(import.meta.env);

export const SITE_URL = env.SITE;
export const SITE_NAME = BRAND.name;

export const COOKIE_POLICY_VERSION = '2026-09-21';
export const SITE_BRAND = 'APPROVED';
export const SITE_TLD = '.rs';
export const DEFAULT_COUNTRY = 'rs';

export const THREADS_CHANNEL = env.PUBLIC_THREADS_CHANNEL;
export const WHATSAPP_NUMBER = env.PUBLIC_WHATSAPP_NUMBER;
export const VIBER_NUMBER = env.PUBLIC_VIBER_NUMBER;
export const PHONE_NUMBER = env.PUBLIC_WHATSAPP_NUMBER;
export const TG_MANAGER = env.PUBLIC_TG_MANAGER;

export const TELEGRAM_BOT_URL = telegramBotLink(BRAND.captureBot);

export const SOCIAL_SAME_AS = [
  TELEGRAM_BOT_URL,
  `https://www.threads.com/@${THREADS_CHANNEL}`,
];

export const CHINA_NAME: Record<Locale, string> = {
  ru: 'Китай',
  en: 'China',
  sr: 'Kina',
  es: 'China',
  de: 'China',
};
export const CHINA_COUNTRY_CODE = 'cn';

export const VEHICLE_IMPORT_EU_SOURCE_CODES = ['es', 'ch'] as const;
