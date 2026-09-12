import { createLeadSchema, createLeadStore } from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';
import { SUPPORTED_LOCALES } from '@/i18n/config';

export const DEFAULT_COMMISSION_PERCENT = 20;
export const BRAND = 'PRIZMA';

export const leadSchema = createLeadSchema({
  locales: SUPPORTED_LOCALES,
  defaultCommissionPercent: DEFAULT_COMMISSION_PERCENT,
  defaultBrand: BRAND,
});

export const leadStore = createLeadStore({
  storage: createVercelBlobStorage({ path: 'data/leads.json' }),
  schema: leadSchema,
});
