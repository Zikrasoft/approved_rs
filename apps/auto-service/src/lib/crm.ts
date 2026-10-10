import {
  createBrandStore,
  deferStorage,
  type LeadStorage,
} from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';
import { SITE_NAME } from '@/utils/constants';
import { localOrBlob } from './localOrBlob';

export const BRAND = SITE_NAME;

const storageFor = (path: string) =>
  localOrBlob<LeadStorage>(
    () => createVercelBlobStorage({ path }),
    ({ createFileStorage }, dir) => createFileStorage({ path, dir }),
    deferStorage,
  );

export const { leadStore } = createBrandStore({
  brand: BRAND,
  storageFor,
  getNotifier: () => import('./crmBot'),
});
