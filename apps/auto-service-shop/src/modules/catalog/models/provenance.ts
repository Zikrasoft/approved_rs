import { model } from '@medusajs/framework/utils';

export const MANUAL_SOURCE = 'manual';
export const WORKSHOP_QUOTE_SOURCE = 'workshop-quote';

export const provenance = () => ({
  source: model.text().default(MANUAL_SOURCE),
  created_by: model.text().nullable(),
  updated_by: model.text().nullable(),
});
