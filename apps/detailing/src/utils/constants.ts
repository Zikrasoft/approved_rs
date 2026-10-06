import { DETAILS, WORKSHOP_ADDRESS } from '@podbor/brands';
import { instagramLink, telegramBotLink } from '@podbor/site-kit/contact-links';
import {
  createPublicEnvSchema,
  withMessengerFallback,
} from '@podbor/site-kit/public-env';
import { z } from 'zod';

export const BRAND = DETAILS;

const publicEnvSchema = createPublicEnvSchema({ siteDefault: BRAND.url })
  .extend({ PUBLIC_INSTAGRAM: z.string().min(1).optional() })
  .transform(withMessengerFallback);

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
export const INSTAGRAM =
  env.PUBLIC_INSTAGRAM === undefined
    ? undefined
    : {
        handle: env.PUBLIC_INSTAGRAM,
        url: instagramLink(env.PUBLIC_INSTAGRAM),
      };

export const TELEGRAM_BOT_URL = telegramBotLink(BRAND.captureBot);

export const SOCIAL_SAME_AS = [
  ...(INSTAGRAM ? [INSTAGRAM.url] : []),
  TELEGRAM_BOT_URL,
];

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
