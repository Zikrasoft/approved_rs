import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { PART_MODULE } from '../../../modules/part';
import type PartModuleService from '../../../modules/part/service';
import { VEHICLE_MODULE } from '../../../modules/vehicle';
import {
  FITMENT_GEARBOX_TYPES,
  FITMENT_STEERING_SIDES,
} from '../../../modules/vehicle/models/fitment';
import type VehicleModuleService from '../../../modules/vehicle/service';

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

const listQuerySchema = z.object({
  vehicle_id: z.string().optional(),
  part_id: z.string().optional(),
});

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { vehicle_id, part_id } = listQuerySchema.parse(req.query);

  const vehicleModuleService: VehicleModuleService =
    req.scope.resolve(VEHICLE_MODULE);

  const fitments = await vehicleModuleService.listFitments({
    ...(vehicle_id ? { vehicle_id } : {}),
    ...(part_id ? { part_id } : {}),
  });

  res.json({ fitments: z.array(fitmentSchema).parse(fitments) });
}

const createBodySchema = z.object({
  part_id: z.string().min(1),
  vehicle_id: z.string().min(1),
  production_from: z.coerce.date().nullable().optional(),
  production_to: z.coerce.date().nullable().optional(),
  steering: z.enum(FITMENT_STEERING_SIDES).nullable().optional(),
  gearbox: z.enum(FITMENT_GEARBOX_TYPES).nullable().optional(),
});

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const body = createBodySchema.parse(req.body);

  const partModuleService: PartModuleService = req.scope.resolve(PART_MODULE);
  const vehicleModuleService: VehicleModuleService =
    req.scope.resolve(VEHICLE_MODULE);

  await vehicleModuleService.retrieveVehicle(body.vehicle_id);
  await partModuleService.retrievePart(body.part_id);

  const fitment = await vehicleModuleService.createFitments({
    ...body,
    source: 'manual',
    status: 'active',
  });

  res.json({ fitment: fitmentSchema.parse(fitment) });
}
