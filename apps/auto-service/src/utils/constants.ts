import { CARLAB } from '@podbor/brands';

export const BRAND = CARLAB;

export const SITE_URL = import.meta.env.SITE ?? BRAND.url;
export const SITE_NAME = BRAND.name;
export const SITE_LEGAL_NAME = BRAND.legalName;

export const SHOP_ENABLED = false;

// TODO: postalCode is left out until the owner confirms it — Zvezdara spans several.
export const GARAGE_ADDRESS = {
  street: 'Jovana Ćirilova 23a',
  district: 'Zvezdara',
  city: 'Beograd',
  country: 'RS',
  lat: 44.8054597,
  lon: 20.4856936,
};

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
// TODO: real Telegram handle not decided yet — placeholder must not ship.
export const TG_MANAGER =
  import.meta.env.PUBLIC_TG_MANAGER ?? 'carlab_rs_placeholder';

export const TELEGRAM_ENABLED = !TG_MANAGER.endsWith('_placeholder');

export const SOCIAL_SAME_AS = TELEGRAM_ENABLED
  ? [`https://t.me/${TG_MANAGER}`]
  : [];

export const CURRENCY = 'RSD';

export const COOKIE_POLICY_VERSION = '2026-09-12';
