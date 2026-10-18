import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { VEHICLE_MODULE } from '../../../modules/vehicle';
import type VehicleModuleService from '../../../modules/vehicle/service';

const vehicleResponseSchema = z.object({
  id: z.string(),
  make: z.string(),
  model: z.string(),
  engine_code: z.string(),
  year_from: z.number().nullable(),
  year_to: z.number().nullable(),
});

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const vehicleModuleService: VehicleModuleService =
    req.scope.resolve(VEHICLE_MODULE);

  const vehicles = await vehicleModuleService.listVehicles();

  res.json({ vehicles: z.array(vehicleResponseSchema).parse(vehicles) });
}
