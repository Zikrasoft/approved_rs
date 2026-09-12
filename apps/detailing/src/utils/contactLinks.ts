import {
  INSTAGRAM,
  PHONE_NUMBER,
  TG_MANAGER,
  VIBER_NUMBER,
  WHATSAPP_NUMBER,
} from './constants';

export const CONTACT_LINKS = {
  phone: `tel:+${PHONE_NUMBER}`,
  whatsapp: `https://wa.me/${WHATSAPP_NUMBER}`,
  viber: `viber://chat?number=%2B${VIBER_NUMBER}`,
  telegram: `https://t.me/${TG_MANAGER}`,
  instagram: `https://www.instagram.com/${INSTAGRAM}`,
} as const;

export { formatPhone } from '@podbor/site-kit';
