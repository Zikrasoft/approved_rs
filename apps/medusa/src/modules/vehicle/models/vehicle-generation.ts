import { model } from '@medusajs/framework/utils';

import { VehicleModel } from './vehicle-model';

export const VehicleGeneration = model
  .define('vehicle_generation', {
    id: model.id({ prefix: 'vgen' }).primaryKey(),
    name: model.text(),
    year_from: model.number(),
    year_to: model.number(),
    vehicle_model: model.belongsTo(() => VehicleModel, {
      mappedBy: 'generations',
    }),
  })
  .indexes([{ on: ['vehicle_model_id', 'name'], unique: true }]);
