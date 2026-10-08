import { createContactControls } from '@podbor/site-kit/contact-control';
import { getLocale } from '@/i18n/config';
import { servicesView } from '@/i18n/content/services';
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
  prefill: (locale) =>
    servicesView(getLocale(locale)).caseChrome.messengerPrefill,
});
