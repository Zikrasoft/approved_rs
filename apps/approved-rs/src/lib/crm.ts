import { createLeadSchema, createLeadStore } from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';

export const DEFAULT_COMMISSION_PERCENT = 10;
export const BRAND = 'Approved.rs';

export const leadSchema = createLeadSchema({
  defaultCommissionPercent: DEFAULT_COMMISSION_PERCENT,
});

export const leadStore = createLeadStore({
  storage: createVercelBlobStorage({ path: 'data/leads.json' }),
  schema: leadSchema,
});
