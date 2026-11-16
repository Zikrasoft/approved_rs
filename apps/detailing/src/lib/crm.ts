import { createBrandStore } from '@podbor/lead-crm';
import { SITE_NAME } from '@/utils/constants';

export const BRAND = SITE_NAME;

export const { leadStore, notifyLead } = createBrandStore({
  brand: BRAND,
  getNotifier: () => import('./crmBot'),
});
