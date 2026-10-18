import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { VEHICLE_MODULE } from '../../../modules/vehicle';
import type VehicleModuleService from '../../../modules/vehicle/service';
import { VIN_LOOKUP_MODULE } from '../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../modules/vin-lookup/service';
import { StructuralOnlyVinDecoder } from '../../../lib/vin-decoder';
import { matchVehicleForVin } from '../../../lib/vin-vehicle-match';
import { vehicleResponseSchema } from '../../../modules/vehicle/store-response';

const bodySchema = z.object({
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/),
});

const decoder = new StructuralOnlyVinDecoder();

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { vin } = bodySchema.parse(req.body ?? {});

  const vehicleModuleService: VehicleModuleService =
    req.scope.resolve(VEHICLE_MODULE);
  const vinLookupModuleService: VinLookupModuleService =
    req.scope.resolve(VIN_LOOKUP_MODULE);

  const [existing] = await vinLookupModuleService.listVinLookups({ vin });
  if (existing) {
    const vehicle = await vehicleModuleService.retrieveVehicle(
      existing.vehicle_id,
    );
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
  const vehicles = await vehicleModuleService.listVehicles();
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
