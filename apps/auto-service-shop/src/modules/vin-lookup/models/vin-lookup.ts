import { model } from '@medusajs/framework/utils';

const VinLookup = model
  .define('vin_lookup', {
    id: model.id().primaryKey(),
    vin: model.text(),
    decoder: model.text().nullable(),
    decoder_version: model.number().nullable(),
    raw: model.json().nullable(),
    facts: model.json(),
    make: model.text().nullable(),
    code: model.text().nullable(),
    vehicle_id: model.text().nullable(),
  })
  .indexes([
    {
      on: ['vin'],
      unique: true,
    },
    { on: ['vehicle_id'] },
    { on: ['make', 'code'], where: { vehicle_id: null } },
  ]);

export default VinLookup;
