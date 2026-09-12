export const prerender = false;

import { waitUntil } from '@vercel/functions';
import { createLeadsRoute } from '@podbor/lead-crm';
import { notifyLead } from '@/lib/notifyLead';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config';
import { PathBuilder } from '@/utils/paths';

const MISSING_FIELDS_MESSAGE: Record<Locale, string> = {
  ru: 'Имя и контакт обязательны',
  en: 'Name and contact are required',
  sr: 'Ime i kontakt su obavezni',
  es: 'El nombre y el contacto son obligatorios',
  de: 'Name und Kontakt sind erforderlich',
};

export const POST = createLeadsRoute({
  notifyLead,
  waitUntil,
  isLocale,
  defaultLocale: DEFAULT_LOCALE,
  localeCookie: 'lang',
  thanksPath: PathBuilder.thanks,
  missingFieldsMessage: MISSING_FIELDS_MESSAGE,
});
