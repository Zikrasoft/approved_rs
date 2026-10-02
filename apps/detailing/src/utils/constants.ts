import { DETAILS, WORKSHOP_ADDRESS } from '@podbor/brands';
import { instagramLink, telegramBotLink } from '@podbor/site-kit/contact-links';

export const BRAND = DETAILS;

export const SITE_URL = import.meta.env.SITE ?? BRAND.url;
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

export const PHONE_NUMBER =
  import.meta.env.PUBLIC_PHONE_NUMBER ?? '381677210533';
export const WHATSAPP_NUMBER =
  import.meta.env.PUBLIC_WHATSAPP_NUMBER ?? PHONE_NUMBER;
export const VIBER_NUMBER = import.meta.env.PUBLIC_VIBER_NUMBER ?? PHONE_NUMBER;
// TODO: the real Instagram handle is not decided yet. Until PUBLIC_INSTAGRAM
// is set the channel is hidden rather than pointed at a guess — a dead link in
// the footer costs more trust than a missing one, and an unreachable sameAs is
// worse than none.
export const INSTAGRAM =
  import.meta.env.PUBLIC_INSTAGRAM ?? 'details_placeholder';

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
