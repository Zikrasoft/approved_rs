export const prerender = false;

import { waitUntil } from '@vercel/functions';
import { createLeadsRoute } from '@podbor/lead-crm';
import { LOCALE_COOKIE } from '@podbor/site-kit';
import { phoneLink, whatsappLink } from '@podbor/site-kit/contact-links';
import { formatPhone } from '@podbor/site-kit/format-phone';
import { notifyLead } from '@/lib/notifyLead';
import { PRIMARY_LOCALE, isLocale, type Locale } from '@/i18n/config';
import { content } from '@/i18n/content';
import { PHONE_NUMBER, WHATSAPP_NUMBER } from '@/utils/constants';
import { PathBuilder } from '@/utils/paths';

const MISSING_FIELDS_MESSAGE: Record<Locale, string> = {
  ru: 'Укажите телефон или мессенджер',
  en: 'Enter a phone number or messenger',
  sr: 'Unesite telefon ili messenger',
  es: 'Indique un teléfono o mensajería',
  de: 'Bitte Telefon oder Messenger angeben',
};

export const POST = createLeadsRoute({
  notifyLead,
  waitUntil,
  isLocale,
  defaultLocale: PRIMARY_LOCALE,
  localeCookie: LOCALE_COOKIE,
  thanksPath: PathBuilder.thanks,
  refusalCopy: (locale) => {
    const form = content(locale).leadForm;
    return {
      reasons: {
        'missing-contact': MISSING_FIELDS_MESSAGE[locale],
        'invalid-phone': form.errorPhoneInvalid,
        'invalid-telegram': form.errorTelegramHandle,
        'missing-consent': form.consentError,
      },
      consent: `${form.consentBefore}${form.consentLinkText}`,
      submit: form.submitLabel,
      links: [
        { label: formatPhone(PHONE_NUMBER), href: phoneLink(PHONE_NUMBER) },
        { label: 'WhatsApp', href: whatsappLink(WHATSAPP_NUMBER) },
      ],
    };
  },
});
