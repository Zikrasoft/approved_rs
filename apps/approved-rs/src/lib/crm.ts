import { APPROVED } from '@podbor/brands';
import { createBrandStore, type LeadStorage } from '@podbor/lead-crm';
import { localLeadStorage } from '@podbor/lead-crm/storage/local';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';

export const BRAND = APPROVED.name;

const storageFor = (path: string): LeadStorage => {
  if (import.meta.env.DEV) return localLeadStorage(path);
  return createVercelBlobStorage({ path });
};

export const { leadStore, ledgerStore, notifyLead } = createBrandStore({
  brand: BRAND,
  storageFor,
  getNotifier: () => import('./crmBot'),
});
