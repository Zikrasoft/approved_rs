import { model } from '@medusajs/framework/utils';
import { VEHICLE_IDENTIFIER_TYPES } from '@podbor/catalog-contract';

import VinLookupHit from './vin-lookup-hit';

const VinLookup = model
  .define('vin_lookup', {
    id: model.id().primaryKey(),
    vin: model.text().nullable(),
    wmi: model.text().nullable(),
    decoder: model.text().nullable(),
    decoder_version: model.number().nullable(),
    raw: model.json().nullable(),
    facts: model.json(),
    make: model.text().nullable(),
    code: model.text().nullable(),
    code_type: model.enum([...VEHICLE_IDENTIFIER_TYPES]).nullable(),
    vehicle_id: model.text().nullable(),
    hits: model.hasMany(() => VinLookupHit, { mappedBy: 'vin_lookup' }),
  })
  .indexes([
    {
      on: ['vin'],
      unique: true,
    },
    { on: ['vehicle_id'] },
    { on: ['make', 'code'], where: { vehicle_id: null } },
  ])
  .checks([
    {
      name: 'vin_lookup_code_type_needs_code',
      expression: 'code_type is null or code is not null',
    },
  ])
  .cascades({ delete: ['hits'] });

export default VinLookup;
