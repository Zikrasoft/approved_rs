import { model } from '@medusajs/framework/utils';
import { VEHICLE_IDENTIFIER_TYPES } from '@podbor/catalog-contract';

import { provenance } from './provenance';
import Vehicle from './vehicle';

const VehicleIdentifier = model
  .define('vehicle_identifier', {
    id: model.id().primaryKey(),
    type: model.enum([...VEHICLE_IDENTIFIER_TYPES]),
    value: model.text(),
    supplier_id: model.text().nullable(),
    vehicle: model.belongsTo(() => Vehicle, { mappedBy: 'identifiers' }),
    ...provenance(),
  })
  .indexes([
    {
      on: ['type', 'value'],
      unique: true,
      where: { supplier_id: null },
    },
    {
      on: ['supplier_id', 'type', 'value'],
      unique: true,
      where: { supplier_id: { $ne: null } },
    },
  ]);

export default VehicleIdentifier;
