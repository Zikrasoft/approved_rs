import { model } from '@medusajs/framework/utils';

import { VehicleGeneration } from './vehicle-generation';
import { VehicleMake } from './vehicle-make';

export const VehicleModel = model
  .define('vehicle_model', {
    id: model.id({ prefix: 'vmod' }).primaryKey(),
    name: model.text(),
    make: model.belongsTo(() => VehicleMake, { mappedBy: 'models' }),
    generations: model.hasMany(() => VehicleGeneration, {
      mappedBy: 'vehicle_model',
    }),
  })
  .cascades({ delete: ['generations'] })
  .indexes([{ on: ['make_id', 'name'], unique: true }]);
