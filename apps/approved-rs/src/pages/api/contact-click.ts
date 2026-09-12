export const prerender = false;

import { waitUntil } from '@vercel/functions';
import { createContactClickRoute } from '@podbor/lead-crm';
import { notifyLead } from '@/lib/notifyLead';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/config';

export const POST = createContactClickRoute({
  notifyLead,
  waitUntil,
  isLocale,
  defaultLocale: DEFAULT_LOCALE,
});
