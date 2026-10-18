import { model } from '@medusajs/framework/utils';

import Vehicle from './vehicle';

export const FITMENT_STEERING_SIDES = ['left', 'right'] as const;
export const FITMENT_GEARBOX_TYPES = ['manual', 'automatic'] as const;
export const FITMENT_STATUSES = ['active', 'rejected'] as const;

const Fitment = model.define('fitment', {
  id: model.id().primaryKey(),
  part_id: model.text(),
  vehicle: model.belongsTo(() => Vehicle, { mappedBy: 'fitments' }),
  production_from: model.dateTime().nullable(),
  production_to: model.dateTime().nullable(),
  steering: model.enum([...FITMENT_STEERING_SIDES]).nullable(),
  gearbox: model.enum([...FITMENT_GEARBOX_TYPES]).nullable(),
  source: model.text().default('manual'),
  status: model.enum([...FITMENT_STATUSES]).default('active'),
});

export default Fitment;
