export const SITE_URL = import.meta.env.SITE ?? 'https://prizma.rs';
export const SITE_NAME = 'PRIZMA';
export const SITE_LEGAL_NAME = 'PRIZMA Detailing Studio';

export const STUDIO_ADDRESS = {
  street: 'Vojvode Stepe 142',
  city: 'Beograd',
  postalCode: '11000',
  country: 'RS',
  lat: 44.7666,
  lon: 20.4772,
};

export const PHONE_NUMBER =
  import.meta.env.PUBLIC_PHONE_NUMBER ?? '381600000000';
export const WHATSAPP_NUMBER =
  import.meta.env.PUBLIC_WHATSAPP_NUMBER ?? PHONE_NUMBER;
export const VIBER_NUMBER = import.meta.env.PUBLIC_VIBER_NUMBER ?? PHONE_NUMBER;
export const TG_MANAGER = import.meta.env.PUBLIC_TG_MANAGER ?? 'prizma_studio';
export const INSTAGRAM = import.meta.env.PUBLIC_INSTAGRAM ?? 'prizma.studio';

export const SOCIAL_SAME_AS = [
  `https://www.instagram.com/${INSTAGRAM}`,
  `https://t.me/${TG_MANAGER}`,
];
