import { model } from '@medusajs/framework/utils';

import { provenance } from './provenance';
import Vehicle from './vehicle';

export const VEHICLE_IDENTIFIER_TYPES = ['ktype', 'oem-type-code'] as const;

const VehicleIdentifier = model
  .define('vehicle_identifier', {
    id: model.id().primaryKey(),
    type: model.enum([...VEHICLE_IDENTIFIER_TYPES]),
    value: model.text(),
    vehicle: model.belongsTo(() => Vehicle, { mappedBy: 'identifiers' }),
    ...provenance(),
  })
  .indexes([
    {
      on: ['type', 'value'],
      unique: true,
    },
  ]);

export default VehicleIdentifier;
