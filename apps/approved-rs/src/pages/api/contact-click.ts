export const prerender = false;

import { createContactClickRoute } from '@podbor/lead-crm';
import { notifyLead } from '@/lib/notifyLead';
import { PRIMARY_LOCALE, isLocale } from '@/i18n/config';

export const POST = createContactClickRoute({
  notifyLead,
  isLocale,
  defaultLocale: PRIMARY_LOCALE,
});
