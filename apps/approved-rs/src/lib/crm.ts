import { APPROVED } from '@podbor/brands';
import {
  createBrandStore,
  localLeadStorage,
  type LeadStorage,
} from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';

export const BRAND = APPROVED.name;

const storageFor = (path: string): LeadStorage => {
  if (import.meta.env.DEV) return localLeadStorage(path);
  return createVercelBlobStorage({ path });
};

export const { leadStore, ledgerStore } = createBrandStore({
  brand: BRAND,
  storageFor,
  getNotifier: () => import('./crmBot'),
});
