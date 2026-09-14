import { DETAILS } from '@podbor/brands';

export const BRAND = DETAILS;

export const SITE_URL = import.meta.env.SITE ?? BRAND.url;
export const SITE_NAME = BRAND.name;
export const SITE_LEGAL_NAME = BRAND.legalName;

// TODO: postalCode left out until the owner confirms it — Zvezdara spans several.
export const STUDIO_ADDRESS = {
  street: 'Jovana Ćirilova 23a',
  district: 'Zvezdara',
  city: 'Beograd',
  country: 'RS',
  lat: 44.8054597,
  lon: 20.4856936,
};

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
// TODO: the real Telegram and Instagram handles are not decided yet. Until
// PUBLIC_TG_MANAGER / PUBLIC_INSTAGRAM are set the channel is hidden rather
// than pointed at a guess — a dead link in the footer costs more trust than a
// missing one, and an unreachable sameAs is worse than none.
export const TG_MANAGER =
  import.meta.env.PUBLIC_TG_MANAGER ?? 'details_placeholder';
export const INSTAGRAM =
  import.meta.env.PUBLIC_INSTAGRAM ?? 'details_placeholder';

export const TELEGRAM_ENABLED = !TG_MANAGER.endsWith('_placeholder');
export const INSTAGRAM_ENABLED = !INSTAGRAM.endsWith('_placeholder');

export const SOCIAL_SAME_AS = [
  ...(INSTAGRAM_ENABLED ? [`https://www.instagram.com/${INSTAGRAM}`] : []),
  ...(TELEGRAM_ENABLED ? [`https://t.me/${TG_MANAGER}`] : []),
];

export const COOKIE_POLICY_VERSION = '2026-09-12';
