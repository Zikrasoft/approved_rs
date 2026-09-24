import { COMMISSION_PERCENT } from '@podbor/brands';
import {
  createLeadSchema,
  createLeadStore,
  createQuarantine,
  LEADS_PATH,
  QUARANTINE_PATH,
} from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';
import { SITE_NAME } from '@/utils/constants';

export const DEFAULT_COMMISSION_PERCENT = COMMISSION_PERCENT.details;
export const BRAND = SITE_NAME;

export const leadSchema = createLeadSchema({
  defaultCommissionPercent: DEFAULT_COMMISSION_PERCENT,
});

export const leadStore = createLeadStore({
  storage: createVercelBlobStorage({ path: LEADS_PATH }),
  schema: leadSchema,
  quarantine: createQuarantine({
    storage: createVercelBlobStorage({ path: QUARANTINE_PATH }),
    brand: BRAND,
    getNotifier: () => import('./crmBot'),
  }),
});
