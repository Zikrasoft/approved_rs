import { createLeadSchema, createLeadStore } from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';
import { SITE_NAME } from '@/utils/constants';

export const DEFAULT_COMMISSION_PERCENT = 20;
export const BRAND = SITE_NAME;

export const leadSchema = createLeadSchema({
  defaultCommissionPercent: DEFAULT_COMMISSION_PERCENT,
});

export const leadStore = createLeadStore({
  storage: createVercelBlobStorage({ path: 'data/leads.json' }),
  schema: leadSchema,
});
