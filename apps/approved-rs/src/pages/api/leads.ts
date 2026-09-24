export const prerender = false;

import { waitUntil } from '@vercel/functions';
import { createLeadsRoute } from '@podbor/lead-crm';
import { LOCALE_COOKIE } from '@podbor/site-kit';
import { notifyLead } from '@/lib/notifyLead';
import { PRIMARY_LOCALE, isLocale, type Locale } from '@/i18n/config';
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
  missingFieldsMessage: MISSING_FIELDS_MESSAGE,
});
