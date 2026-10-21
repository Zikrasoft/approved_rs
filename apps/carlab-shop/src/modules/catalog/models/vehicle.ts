import { model } from '@medusajs/framework/utils';

import Fitment from './fitment';
import { provenance } from './provenance';
import VehicleIdentifier from './vehicle-identifier';

const Vehicle = model
  .define('vehicle', {
    id: model.id().primaryKey(),
    make: model.text(),
    model: model.text(),
    engine_code: model.text(),
    year_from: model.number().nullable(),
    year_to: model.number().nullable(),
    identifiers: model.hasMany(() => VehicleIdentifier, {
      mappedBy: 'vehicle',
    }),
    fitments: model.hasMany(() => Fitment, { mappedBy: 'vehicle' }),
    ...provenance(),
  })
  .cascades({ delete: ['identifiers', 'fitments'] });

export default Vehicle;
