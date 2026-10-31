export const prerender = false;

import { waitUntil } from '@vercel/functions';
import { createLeadsRoute } from '@podbor/lead-crm';
import { LOCALE_COOKIE } from '@podbor/site-kit';
import { notifyLead } from '@/lib/crm';
import { PRIMARY_LOCALE, isLocale, type Locale } from '@/i18n/config';
import { PathBuilder } from '@/utils/paths';
import { VIN_INQUIRY_SERVICE } from '@/utils/services';

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
  thanksPath: (locale, service) =>
    service === VIN_INQUIRY_SERVICE
      ? PathBuilder.partsThanks(locale)
      : PathBuilder.thanks(locale),
  missingFieldsMessage: MISSING_FIELDS_MESSAGE,
  orderCanceled: {
    secret: [
      process.env.SHOP_LEAD_SECRET,
      process.env.SHOP_LEAD_SECRET_PREVIOUS,
    ],
    cancel: async (orderId) =>
      (await import('@/lib/crmBot')).cancelOrderLead(orderId),
  },
});
