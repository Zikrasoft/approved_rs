import { COMMISSION_PERCENT } from '@podbor/brands';
import { createBrandStore, type LeadStorage } from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';
import { SITE_NAME } from '@/utils/constants';
import { localOrBlob } from './localOrBlob';

export const BRAND = SITE_NAME;

const storageFor = (path: string) =>
  localOrBlob<LeadStorage>(
    () => createVercelBlobStorage({ path }),
    ({ createFileStorage }, dir) => createFileStorage({ path, dir }),
    (opened) => ({
      read: async () => (await opened).read(),
      write: async (leads, version) => (await opened).write(leads, version),
    }),
  );

export const { leadStore, leadSchema } = createBrandStore({
  brand: BRAND,
  commissionPercent: COMMISSION_PERCENT.carlab,
  storageFor,
  getNotifier: () => import('./crmBot'),
});
