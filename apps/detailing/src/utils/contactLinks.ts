import {
  instagramLink,
  phoneLink,
  telegramLink,
  viberLink,
  whatsappLink,
} from '@podbor/site-kit/contact-links';
import {
  INSTAGRAM,
  PHONE_NUMBER,
  TG_MANAGER,
  VIBER_NUMBER,
  WHATSAPP_NUMBER,
} from './constants';

export const CONTACT_LINKS = {
  phone: phoneLink(PHONE_NUMBER),
  whatsapp: whatsappLink(WHATSAPP_NUMBER),
  viber: viberLink(VIBER_NUMBER),
  telegram: telegramLink(TG_MANAGER),
  instagram: instagramLink(INSTAGRAM),
} as const;
