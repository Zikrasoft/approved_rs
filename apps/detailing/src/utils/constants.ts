import { DETAILS, WORKSHOP_ADDRESS, socialLinks } from '@podbor/brands';
import { telegramBotLink } from '@podbor/site-kit/contact-links';
import {
  createPublicEnvSchema,
  withMessengerFallback,
} from '@podbor/site-kit/public-env';

export const BRAND = DETAILS;

const publicEnvSchema = createPublicEnvSchema({
  siteDefault: BRAND.url,
}).transform(withMessengerFallback);

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
export const TG_MANAGER = env.PUBLIC_TG_MANAGER;
export const TELEGRAM_BOT_URL = telegramBotLink(BRAND.captureBot);

export const SOCIAL_LINKS = socialLinks(BRAND.social);

export const SOCIAL_SAME_AS = [
  ...SOCIAL_LINKS.map((link) => link.url),
  TELEGRAM_BOT_URL,
];

export const COOKIE_POLICY_VERSION = '2026-10-23';

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
