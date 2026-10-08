import { createContactControls } from '@podbor/site-kit/contact-control';
import {
  BRAND,
  PHONE_NUMBER,
  VIBER_NUMBER,
  WHATSAPP_NUMBER,
} from './constants';

export const contactControl = createContactControls({
  phone: PHONE_NUMBER,
  whatsapp: WHATSAPP_NUMBER,
  viber: VIBER_NUMBER,
  captureBot: BRAND.captureBot,
});
