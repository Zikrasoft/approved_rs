import { model } from '@medusajs/framework/utils';
import { STEERING_SIDES, VEHICLE_DRIVES } from '@podbor/catalog-contract';

import Engine from './engine';
import Fitment from './fitment';
import { provenance } from './provenance';
import Requirement from './requirement';
import VehicleIdentifier from './vehicle-identifier';
import VehicleModel from './vehicle-model';

const Vehicle = model
  .define('vehicle', {
    id: model.id().primaryKey(),
    slug: model.text(),
    model: model.belongsTo(() => VehicleModel, { mappedBy: 'vehicles' }),
    engine: model.belongsTo(() => Engine, { mappedBy: 'vehicles' }),
    power_kw: model.number().nullable(),
    drive: model.enum([...VEHICLE_DRIVES]).nullable(),
    market: model.text().nullable(),
    year_from: model.number().nullable(),
    year_to: model.number().nullable(),
    steering: model.enum([...STEERING_SIDES]).nullable(),
    identifiers: model.hasMany(() => VehicleIdentifier, {
      mappedBy: 'vehicle',
    }),
    fitments: model.hasMany(() => Fitment, { mappedBy: 'vehicle' }),
    requirements: model.hasMany(() => Requirement, { mappedBy: 'vehicle' }),
    ...provenance(),
  })
  .indexes([{ on: ['model_id', 'slug'], unique: true }])
  .cascades({ delete: ['identifiers', 'fitments', 'requirements'] });

export default Vehicle;
