export const SITE_URL = import.meta.env.SITE ?? 'https://autohub.rs';
export const SITE_NAME = 'AUTOHUB';
export const SITE_LEGAL_NAME = 'AUTOHUB auto servis';

export const GARAGE_ADDRESS = {
  street: 'Zrenjaninski put 84',
  city: 'Beograd',
  postalCode: '11210',
  country: 'RS',
  lat: 44.8567,
  lon: 20.4712,
};

export const PHONE_NUMBER =
  import.meta.env.PUBLIC_PHONE_NUMBER ?? '381110000000';
export const WHATSAPP_NUMBER =
  import.meta.env.PUBLIC_WHATSAPP_NUMBER ?? PHONE_NUMBER;
export const VIBER_NUMBER = import.meta.env.PUBLIC_VIBER_NUMBER ?? PHONE_NUMBER;
export const TG_MANAGER = import.meta.env.PUBLIC_TG_MANAGER ?? 'autohub_rs';

export const SOCIAL_SAME_AS = [`https://t.me/${TG_MANAGER}`];

export const CURRENCY = 'EUR';
export const CURRENCY_SYMBOL = '€';
