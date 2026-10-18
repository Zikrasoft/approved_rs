import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { VEHICLE_MODULE } from '../../../../../modules/vehicle';
import {
  FITMENT_GEARBOX_TYPES,
  FITMENT_STEERING_SIDES,
} from '../../../../../modules/vehicle/models/fitment';
import type VehicleModuleService from '../../../../../modules/vehicle/service';

const paramsSchema = z.object({
  id: z.string().min(1),
});

const fitmentSchema = z.object({
  id: z.string(),
  part_id: z.string(),
  vehicle_id: z.string(),
  production_from: z.date().nullable(),
  production_to: z.date().nullable(),
  steering: z.enum(FITMENT_STEERING_SIDES).nullable(),
  gearbox: z.enum(FITMENT_GEARBOX_TYPES).nullable(),
  source: z.string(),
  status: z.string(),
});

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = paramsSchema.parse(req.params);

  const vehicleModuleService: VehicleModuleService =
    req.scope.resolve(VEHICLE_MODULE);

  await vehicleModuleService.retrieveFitment(id);

  const fitment = await vehicleModuleService.updateFitments({
    id,
    status: 'rejected',
  });

  res.json({ fitment: fitmentSchema.parse(fitment) });
}
