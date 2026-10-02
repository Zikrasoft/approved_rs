import { telegramLink, whatsappLink } from './contactLinks';
import { getServicesContent } from '@/i18n/content/services';
import type { Locale } from '@/i18n/config';
import { TG_MANAGER, WHATSAPP_NUMBER } from './constants';

export function messengerHrefs(
  locale: Locale,
  manager: string = TG_MANAGER,
): { telegram: string; whatsapp: string } {
  const { messengerPrefill } = getServicesContent(locale).caseChrome;
  return {
    telegram: telegramLink(manager, messengerPrefill),
    whatsapp: whatsappLink(WHATSAPP_NUMBER, messengerPrefill),
  };
}
