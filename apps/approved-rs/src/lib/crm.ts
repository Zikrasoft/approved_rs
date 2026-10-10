import { APPROVED } from '@podbor/brands';
import {
  createBrandStore,
  deferStorage,
  LOCAL_DATA_DIR,
  type LeadStorage,
} from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';

export const BRAND = APPROVED.name;

let fileStorage:
  Promise<typeof import('@podbor/lead-crm/storage/file')> | undefined;

const storageFor = (path: string): LeadStorage => {
  if (import.meta.env.DEV) {
    fileStorage ??= import('@podbor/lead-crm/storage/file');
    return deferStorage(
      fileStorage.then(({ createFileStorage }) =>
        createFileStorage({ path, dir: LOCAL_DATA_DIR }),
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
