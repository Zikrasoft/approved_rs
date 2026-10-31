export const prerender = false;

import { createShopOrdersRoute } from '@podbor/lead-crm';
import { notifyLead } from '@/lib/crm';
import { PRIMARY_LOCALE, isLocale } from '@/i18n/config';

export const POST = createShopOrdersRoute({
  secret: process.env.SHOP_LEAD_SECRET,
  notifyLead,
  cancelOrder: async (orderId) =>
    (await import('@/lib/crmBot')).cancelOrderLead(orderId),
  isLocale,
  defaultLocale: PRIMARY_LOCALE,
});
