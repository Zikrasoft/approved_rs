import { APPROVED } from '@podbor/brands';
import { createBrandStore } from '@podbor/lead-crm';

export const BRAND = APPROVED.name;

export const { leadStore, ledgerStore, notifyLead } = createBrandStore({
  brand: BRAND,
  getNotifier: () => import('./crmBot'),
});
