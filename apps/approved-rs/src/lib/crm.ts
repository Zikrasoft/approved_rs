import { APPROVED } from '@podbor/brands';
import {
  createBrandStore,
  deferStorage,
  LOCAL_DATA_DIR,
  type LeadStorage,
} from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';

export const BRAND = APPROVED.name;

const storageFor = (path: string): LeadStorage => {
  if (import.meta.env.DEV) {
    return deferStorage(
      import('@podbor/lead-crm/storage/file').then(({ createFileStorage }) =>
        createFileStorage({ path, dir: LOCAL_DATA_DIR }),
      ),
    );
  }
  return createVercelBlobStorage({ path });
};

export const { leadStore } = createBrandStore({
  brand: BRAND,
  storageFor,
  getNotifier: () => import('./crmBot'),
});
