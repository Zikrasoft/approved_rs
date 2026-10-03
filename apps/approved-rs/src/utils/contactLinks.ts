import {
  captureBotLink,
  phoneLink,
  telegramBotLink,
  viberLink,
  whatsappLink,
} from '@podbor/site-kit/contact-links';
import type { Locale } from '@/i18n/config';
import { BRAND } from './constants';

export { phoneLink, telegramBotLink, viberLink, whatsappLink };

export const telegramBotHref = (locale: Locale, service?: string): string =>
  captureBotLink(BRAND.captureBot, locale, service);
