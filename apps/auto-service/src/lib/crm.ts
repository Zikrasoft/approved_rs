import { PARTS_ORDER_SERVICE } from '@podbor/brands';
import { createBrandStore, type LeadStorage } from '@podbor/lead-crm';
import { localLeadStorage } from '@podbor/lead-crm/storage/local';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';
import { SITE_NAME } from '@/utils/constants';

export const BRAND = SITE_NAME;

const storageFor = (path: string): LeadStorage => {
  if (import.meta.env.DEV) return localLeadStorage(path);
  return createVercelBlobStorage({ path });
};

export const { leadStore } = createBrandStore({
  brand: BRAND,
  storageFor,
  getNotifier: () => import('./crmBot'),
  standaloneServices: [PARTS_ORDER_SERVICE],
});
