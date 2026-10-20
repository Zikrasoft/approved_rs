import { createContactControls } from '@podbor/site-kit/contact-control';
import {
  BRAND,
  PHONE_NUMBER,
  TG_MANAGER,
  VIBER_NUMBER,
  WHATSAPP_NUMBER,
} from './constants';

export const contactControl = createContactControls({
  phone: PHONE_NUMBER,
  whatsapp: WHATSAPP_NUMBER,
  viber: VIBER_NUMBER,
  captureBot: BRAND.captureBot,
  humanTelegram: TG_MANAGER,
});
