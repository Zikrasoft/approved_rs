import { CARLAB, WORKSHOP_ADDRESS } from '@podbor/brands';
import { telegramBotLink } from '@podbor/site-kit/contact-links';

export const BRAND = CARLAB;

export const SITE_URL = import.meta.env.SITE ?? BRAND.url;
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

export const PHONE_NUMBER =
  import.meta.env.PUBLIC_PHONE_NUMBER ?? '381677210533';
export const WHATSAPP_NUMBER =
  import.meta.env.PUBLIC_WHATSAPP_NUMBER ?? PHONE_NUMBER;
export const VIBER_NUMBER = import.meta.env.PUBLIC_VIBER_NUMBER ?? PHONE_NUMBER;
export const TG_MANAGER = import.meta.env.PUBLIC_TG_MANAGER ?? 'carlabrs';

export const TELEGRAM_ENABLED = !TG_MANAGER.endsWith('_placeholder');

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
