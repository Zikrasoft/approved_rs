import {
  instagramLink,
  phoneLink,
  viberLink,
  whatsappLink,
} from '@podbor/site-kit/contact-links';
import {
  INSTAGRAM,
  PHONE_NUMBER,
  VIBER_NUMBER,
  WHATSAPP_NUMBER,
} from './constants';

export const CONTACT_LINKS = {
  phone: phoneLink(PHONE_NUMBER),
  whatsapp: whatsappLink(WHATSAPP_NUMBER),
  viber: viberLink(VIBER_NUMBER),
  instagram: instagramLink(INSTAGRAM),
} as const;
