import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { vehicleResponseSchema } from '../../../lib/store-response';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../modules/vin-lookup/service';
import { StructuralOnlyVinDecoder } from '../../../lib/vin-decoder';
import { matchVehicleForVin } from '../../../lib/vin-vehicle-match';
import type { StoreCreateVinLookupType } from '../validators';

const decoder = new StructuralOnlyVinDecoder();

export async function POST(
  req: MedusaRequest<StoreCreateVinLookupType>,
  res: MedusaResponse,
): Promise<void> {
  const { vin } = req.validatedBody;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const vinLookupModuleService: VinLookupModuleService =
    req.scope.resolve(VIN_LOOKUP_MODULE);

  const [existing] = await vinLookupModuleService.listVinLookups({ vin });
  if (existing) {
    const vehicle = await catalog.retrieveVehicle(existing.vehicle_id);
    res.json({
      resolved: true,
      vehicle: vehicleResponseSchema.parse(vehicle),
      vin_lookup_id: existing.id,
      decoder: decoder.name,
      decode: existing.decode_metadata,
    });
    return;
  }

  const decode = decoder.decode(vin);
  const vehicles = await catalog.listVehicles();
  const matched = matchVehicleForVin(decode, vehicles);

  if (!matched) {
    res.json({
      resolved: false,
      vehicle: null,
      vin_lookup_id: null,
      decoder: decoder.name,
      decode,
    });
    return;
  }

  const vinLookup = await vinLookupModuleService.createVinLookups({
    vin,
    vehicle_id: matched.id,
    decode_metadata: { decoder: decoder.name, ...decode },
  });

  res.json({
    resolved: true,
    vehicle: vehicleResponseSchema.parse(matched),
    vin_lookup_id: vinLookup.id,
    decoder: decoder.name,
    decode,
  });
}
