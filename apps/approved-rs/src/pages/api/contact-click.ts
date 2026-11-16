export const prerender = false;

import { inBackground } from '@podbor/site-kit/background';
import { createContactClickRoute } from '@podbor/lead-crm';
import { notifyLead } from '@/lib/notifyLead';
import { PRIMARY_LOCALE, isLocale } from '@/i18n/config';

export const POST = createContactClickRoute({
  notifyLead,
  inBackground,
  isLocale,
  defaultLocale: PRIMARY_LOCALE,
});
