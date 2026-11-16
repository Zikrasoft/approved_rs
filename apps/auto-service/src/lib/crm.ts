import { PARTS_ORDER_SERVICE } from '@podbor/brands';
import { createBrandStore } from '@podbor/lead-crm';
import { SITE_NAME } from '@/utils/constants';
import { reportedNotifyLead } from './shopEvents';

export const BRAND = SITE_NAME;

const store = createBrandStore({
  brand: BRAND,
  getNotifier: () => import('./crmBot'),
  standaloneServices: [PARTS_ORDER_SERVICE],
});

export const { leadStore } = store;

export const notifyLead = reportedNotifyLead(store.notifyLead);
