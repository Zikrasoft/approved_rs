import { COMMISSION_PERCENT } from '@podbor/brands';
import {
  createBrandStore,
  LOCAL_DATA_DIR,
  type LeadStorage,
} from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';
import { SITE_NAME } from '@/utils/constants';

export const BRAND = SITE_NAME;

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
  commissionPercent: COMMISSION_PERCENT.details,
  storageFor,
  getNotifier: () => import('./crmBot'),
});
