import { DETAILS, WORKSHOP_ADDRESS } from '@podbor/brands';
import { instagramLink, telegramBotLink } from '@podbor/site-kit/contact-links';
import { z } from 'zod';

export const BRAND = DETAILS;

const publicEnvSchema = z
  .object({
    SITE: z.string().min(1).default(BRAND.url),
    PUBLIC_PHONE_NUMBER: z.string().min(1),
    PUBLIC_WHATSAPP_NUMBER: z.string().min(1).optional(),
    PUBLIC_VIBER_NUMBER: z.string().min(1).optional(),
    PUBLIC_INSTAGRAM: z.string().min(1).default('details_placeholder'),
  })
  .transform((env) => ({
    ...env,
    PUBLIC_WHATSAPP_NUMBER:
      env.PUBLIC_WHATSAPP_NUMBER ?? env.PUBLIC_PHONE_NUMBER,
    PUBLIC_VIBER_NUMBER: env.PUBLIC_VIBER_NUMBER ?? env.PUBLIC_PHONE_NUMBER,
  }));

export function readPublicEnv(env: Record<string, unknown>) {
  return publicEnvSchema.parse(env);
}

const env = readPublicEnv(import.meta.env);

export const SITE_URL = env.SITE;
export const SITE_NAME = BRAND.name;
export const SITE_LEGAL_NAME = BRAND.legalName;

export const STUDIO_ADDRESS = WORKSHOP_ADDRESS;

export const OPENING_HOURS = {
  days: [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ] as const,
  opens: '09:00',
  closes: '19:00',
};

export const PHONE_NUMBER = env.PUBLIC_PHONE_NUMBER;
export const WHATSAPP_NUMBER = env.PUBLIC_WHATSAPP_NUMBER;
export const VIBER_NUMBER = env.PUBLIC_VIBER_NUMBER;
// TODO: hidden until the real Instagram handle is decided and PUBLIC_INSTAGRAM is set.
export const INSTAGRAM = env.PUBLIC_INSTAGRAM;

export const INSTAGRAM_ENABLED = !INSTAGRAM.endsWith('_placeholder');

export const TELEGRAM_BOT_URL = telegramBotLink(BRAND.captureBot);

export const SOCIAL_SAME_AS = [
  ...(INSTAGRAM_ENABLED ? [instagramLink(INSTAGRAM)] : []),
  TELEGRAM_BOT_URL,
];

export const YM_COUNTER_ID = 112647721;

export const COOKIE_POLICY_VERSION = '2026-09-15';

export const PHONE_COUNTRY_SHORTLIST = [
  'RS',
  'ME',
  'BA',
  'HR',
  'MK',
  'SI',
  'DE',
  'AT',
  'RU',
  'UA',
  'BY',
] as const;
