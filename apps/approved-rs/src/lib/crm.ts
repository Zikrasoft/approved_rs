import { APPROVED } from '@podbor/brands';
import {
  createBrandStore,
  deferStorage,
  fromLocalFiles,
  type LeadStorage,
} from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';

export const BRAND = APPROVED.name;

const storageFor = (path: string): LeadStorage => {
  if (import.meta.env.DEV) {
    return deferStorage(
      fromLocalFiles(({ createFileStorage }, dir) =>
        createFileStorage({ path, dir }),
      ),
    );
  }
  return createVercelBlobStorage({ path });
};

export const { leadStore, ledgerStore } = createBrandStore({
  brand: BRAND,
  storageFor,
  getNotifier: () => import('./crmBot'),
});
