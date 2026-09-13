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
// TODO: real Telegram and Instagram handles are not decided yet.
export const TG_MANAGER = import.meta.env.PUBLIC_TG_MANAGER ?? 'details_studio';
export const INSTAGRAM = import.meta.env.PUBLIC_INSTAGRAM ?? 'details.studio';

export const SOCIAL_SAME_AS = [
  `https://www.instagram.com/${INSTAGRAM}`,
  `https://t.me/${TG_MANAGER}`,
];
