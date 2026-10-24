import { model } from '@medusajs/framework/utils';

export const MANUAL_SOURCE = 'manual';

export const provenance = () => ({
  source: model.text().default(MANUAL_SOURCE),
  created_by: model.text().nullable(),
  updated_by: model.text().nullable(),
});
