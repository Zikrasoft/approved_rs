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
import { LOCAL_LEADS_DIR } from './localStorageDir';

export const DEFAULT_COMMISSION_PERCENT = COMMISSION_PERCENT.carlab;
export const BRAND = SITE_NAME;

export const leadSchema = createLeadSchema({
  defaultCommissionPercent: DEFAULT_COMMISSION_PERCENT,
});

const createDevStorage = import.meta.env.DEV
  ? (await import('@podbor/lead-crm/storage/file')).createFileStorage
  : null;

const storageFor = (path: string): LeadStorage =>
  createDevStorage
    ? createDevStorage({ path, dir: LOCAL_LEADS_DIR })
    : createVercelBlobStorage({ path });

export const leadStore = createLeadStore({
  storage: storageFor(LEADS_PATH),
  schema: leadSchema,
  quarantine: createQuarantine({
    storage: storageFor(QUARANTINE_PATH),
    brand: BRAND,
    getNotifier: () => import('./crmBot'),
  }),
});
