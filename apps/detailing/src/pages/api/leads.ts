export const prerender = false;

import { waitUntil } from '@vercel/functions';
import { createLeadsRoute } from '@podbor/lead-crm';
import { LOCALE_COOKIE } from '@podbor/site-kit';
import { notifyLead } from '@/lib/crm';
import { PRIMARY_LOCALE, isLocale, type Locale } from '@/i18n/config';
import { content } from '@/i18n/content';
import { PathBuilder } from '@/utils/paths';

const MISSING_FIELDS_MESSAGE: Record<Locale, string> = {
  ru: 'Укажите контакт',
  sr: 'Unesite kontakt',
  en: 'Enter a contact',
};

export const POST = createLeadsRoute({
  notifyLead,
  waitUntil,
  isLocale,
  defaultLocale: PRIMARY_LOCALE,
  localeCookie: LOCALE_COOKIE,
  thanksPath: PathBuilder.thanks,
  refusalCopy: (locale) => ({
    message: MISSING_FIELDS_MESSAGE[locale],
    consent: `${content(locale).site.form.privacyNote} ${content(locale).site.form.privacyLinkText}`,
  }),
});
