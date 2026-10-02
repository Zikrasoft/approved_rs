import type { SiteContent } from '@/i18n/content/site';
import type { Locale } from '@/i18n/config';
import {
  captureStartPayload,
  phoneLink,
  telegramBotLink,
  viberLink,
  whatsappLink,
} from '@podbor/site-kit/contact-links';
import {
  BRAND,
  PHONE_NUMBER,
  VIBER_NUMBER,
  WHATSAPP_NUMBER,
} from './constants';

export const CONTACT_LINKS = {
  phone: phoneLink(PHONE_NUMBER),
  whatsapp: whatsappLink(WHATSAPP_NUMBER),
  viber: viberLink(VIBER_NUMBER),
} as const;

export const telegramBotHref = (locale: Locale, service?: string): string =>
  telegramBotLink(BRAND.captureBot, captureStartPayload(service, locale));

export const contactChannels = (
  site: SiteContent,
  locale: Locale,
  service?: string,
) =>
  [
    {
      href: CONTACT_LINKS.phone,
      icon: 'phone',
      label: site.channels.call,
      track: 'phone',
    },
    {
      href: CONTACT_LINKS.whatsapp,
      icon: 'whatsapp',
      label: site.channels.whatsapp,
      track: 'whatsapp',
    },
    {
      href: CONTACT_LINKS.viber,
      icon: 'viber',
      label: site.channels.viber,
      track: 'viber',
    },
    {
      href: telegramBotHref(locale, service),
      icon: 'telegram',
      label: site.channels.telegram,
      track: 'telegram',
    },
  ] as const;
