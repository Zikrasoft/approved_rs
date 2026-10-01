import { COMMISSION_PERCENT } from '@podbor/brands';
import {
  createLeadSchema,
  createLeadStore,
  createQuarantine,
  LEADS_PATH,
  QUARANTINE_PATH,
  type LeadStorage,
} from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';
import { SITE_NAME } from '@/utils/constants';
import { LOCAL_DATA_DIR } from './localDataDir';

export const DEFAULT_COMMISSION_PERCENT = COMMISSION_PERCENT.carlab;
export const BRAND = SITE_NAME;

export const leadSchema = createLeadSchema({
  defaultCommissionPercent: DEFAULT_COMMISSION_PERCENT,
});

const storageFor = (path: string): LeadStorage => {
  if (import.meta.env.DEV) {
    const opened = async () => {
      const { createFileStorage } =
        await import('@podbor/lead-crm/storage/file');
      return createFileStorage({ path, dir: LOCAL_DATA_DIR });
    };
    return {
      read: async () => (await opened()).read(),
      write: async (leads, version) => (await opened()).write(leads, version),
    };
  }
  return createVercelBlobStorage({ path });
};

export const leadStore = createLeadStore({
  storage: storageFor(LEADS_PATH),
  schema: leadSchema,
  quarantine: createQuarantine({
    storage: storageFor(QUARANTINE_PATH),
    brand: BRAND,
    getNotifier: () => import('./crmBot'),
  }),
});
