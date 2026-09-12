export const prerender = false;

import { waitUntil } from '@vercel/functions';
import { createContactClickRoute } from '@podbor/lead-crm';
import { notifyLead } from '@/lib/crmBot';
import { DEFAULT_LOCALE } from '@/i18n/config';

export const POST = createContactClickRoute({
  notifyLead,
  waitUntil,
  defaultLocale: DEFAULT_LOCALE,
});
