import { CARLAB, WORKSHOP_ADDRESS } from '@podbor/brands';
import { telegramBotLink } from '@podbor/site-kit/contact-links';
import { createPublicEnvSchema } from '@podbor/site-kit/public-env';

export const BRAND = CARLAB;

const publicEnvSchema = createPublicEnvSchema({
  siteDefault: BRAND.url,
});

export function readPublicEnv(env: Record<string, unknown>) {
  return publicEnvSchema.parse(env);
}

const env = readPublicEnv(import.meta.env);

export const SITE_URL = env.SITE;
export const SITE_NAME = BRAND.name;
export const SITE_LEGAL_NAME = BRAND.legalName;

export const GARAGE_ADDRESS = WORKSHOP_ADDRESS;

export const OPENING_HOURS = [
  {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '08:00',
    closes: '18:00',
  },
  {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Saturday'],
    opens: '09:00',
    closes: '14:00',
  },
];

export const PHONE_NUMBER = env.PUBLIC_PHONE_NUMBER;
export const WHATSAPP_NUMBER = env.PUBLIC_WHATSAPP_NUMBER;
export const VIBER_NUMBER = env.PUBLIC_VIBER_NUMBER;
export const TELEGRAM_BOT_URL = telegramBotLink(BRAND.captureBot);

export const SOCIAL_SAME_AS = [TELEGRAM_BOT_URL];

export const YM_COUNTER_ID = 112647692;

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
