import { model } from '@medusajs/framework/utils';

export interface VinDecodeMetadata {
  decoder: string;
  wmi: string;
  manufacturer: string | null;
  plantCode: string;
  yearCandidates: number[];
  bestYearCandidate: number | null;
}

const VinLookup = model
  .define('vin_lookup', {
    id: model.id().primaryKey(),
    vin: model.text(),
    vehicle_id: model.text(),
    decode_metadata: model.json<VinDecodeMetadata>(),
  })
  .indexes([
    {
      on: ['vin'],
      unique: true,
    },
  ]);

export default VinLookup;
