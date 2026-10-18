import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { VEHICLE_MODULE } from '../../../modules/vehicle';
import type VehicleModuleService from '../../../modules/vehicle/service';
import { vehicleResponseSchema } from '../../../modules/vehicle/store-response';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const vehicleModuleService: VehicleModuleService =
    req.scope.resolve(VEHICLE_MODULE);

  const vehicles = await vehicleModuleService.listVehicles();

  res.json({ vehicles: z.array(vehicleResponseSchema).parse(vehicles) });
}
