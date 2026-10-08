import { APPROVED, COMMISSION_PERCENT } from '@podbor/brands';
import {
  createBrandStore,
  LOCAL_DATA_DIR,
  type LeadStorage,
} from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';

export const BRAND = APPROVED.name;

const storageFor = (path: string): LeadStorage => {
  if (import.meta.env.DEV) {
    const opened = import('@podbor/lead-crm/storage/file').then(
      ({ createFileStorage }) =>
        createFileStorage({ path, dir: LOCAL_DATA_DIR }),
    );
    return {
      read: async () => (await opened).read(),
      write: async (leads, version) => (await opened).write(leads, version),
    };
  }
  return createVercelBlobStorage({ path });
};

export const { leadStore } = createBrandStore({
  brand: BRAND,
  commissionPercent: COMMISSION_PERCENT.approved,
  storageFor,
  getNotifier: () => import('./crmBot'),
});
