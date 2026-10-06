import {
  captureBotLink,
  instagramLink,
  phoneLink,
  viberLink,
  whatsappLink,
} from '@podbor/site-kit/contact-links';
import type { Locale } from '@/i18n/config';
import type { ServiceSlug } from './services';
import {
  BRAND,
  INSTAGRAM,
  PHONE_NUMBER,
  VIBER_NUMBER,
  WHATSAPP_NUMBER,
} from './constants';

export const CONTACT_LINKS = {
  phone: phoneLink(PHONE_NUMBER),
  whatsapp: whatsappLink(WHATSAPP_NUMBER),
  viber: viberLink(VIBER_NUMBER),
  instagram: INSTAGRAM === undefined ? undefined : instagramLink(INSTAGRAM),
} as const;

export const telegramBotHref = (
  locale: Locale,
  service?: ServiceSlug,
): string => captureBotLink(BRAND.captureBot, locale, service);
