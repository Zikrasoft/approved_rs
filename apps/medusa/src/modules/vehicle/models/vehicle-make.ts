import { model } from '@medusajs/framework/utils';

import { VehicleModel } from './vehicle-model';

export const VehicleMake = model
  .define('vehicle_make', {
    id: model.id({ prefix: 'vmake' }).primaryKey(),
    name: model.text().unique(),
    models: model.hasMany(() => VehicleModel, { mappedBy: 'make' }),
  })
  .cascades({ delete: ['models'] });
