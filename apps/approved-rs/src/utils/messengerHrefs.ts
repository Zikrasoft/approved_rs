import { captureBotLink, whatsappLink } from './contactLinks';
import { getServicesContent } from '@/i18n/content/services';
import type { Locale } from '@/i18n/config';
import { BRAND, WHATSAPP_NUMBER } from './constants';

export function messengerHrefs(
  locale: Locale,
  service?: string,
): { telegram: string; whatsapp: string } {
  const { messengerPrefill } = getServicesContent(locale).caseChrome;
  return {
    telegram: captureBotLink(BRAND.captureBot, locale, service),
    whatsapp: whatsappLink(WHATSAPP_NUMBER, messengerPrefill),
  };
}
