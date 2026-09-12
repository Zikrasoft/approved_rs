export const prerender = false;

import { waitUntil } from '@vercel/functions';
import { createLeadsRoute } from '@podbor/lead-crm';
import { notifyLead } from '@/lib/crmBot';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config';
import { PathBuilder } from '@/utils/paths';

const MISSING_FIELDS_MESSAGE: Record<Locale, string> = {
  ru: 'Заполните имя и контакт',
  sr: 'Unesite ime i kontakt',
  en: 'Please fill in your name and contact',
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
