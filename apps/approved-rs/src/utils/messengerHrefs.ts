import { telegramBotHref, whatsappLink } from './contactLinks';
import { telegramLink } from '@podbor/site-kit/contact-links';
import { getServices } from '@/i18n/content/services';
import type { Locale } from '@/i18n/config';
import { TG_MANAGER, WHATSAPP_NUMBER } from './constants';

export function messengerHrefs(
  locale: Locale,
  service?: string,
  { human = false }: { human?: boolean } = {},
): { telegram: string; whatsapp: string } {
  const { messengerPrefill } = getServices(locale).caseChrome;
  return {
    telegram:
      human && TG_MANAGER
        ? telegramLink(TG_MANAGER)
        : telegramBotHref(locale, service),
    whatsapp: whatsappLink(WHATSAPP_NUMBER, messengerPrefill),
  };
}
