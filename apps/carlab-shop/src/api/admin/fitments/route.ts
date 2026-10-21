import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../../modules/catalog';
import {
  FITMENT_GEARBOX_TYPES,
  FITMENT_STEERING_SIDES,
} from '../../../modules/catalog/models/fitment';
import type CatalogModuleService from '../../../modules/catalog/service';
import type {
  AdminCreateFitmentType,
  AdminListFitmentsType,
} from '../validators';

const fitmentSchema = z.object({
  id: z.string(),
  part_id: z.string(),
  vehicle_id: z.string(),
  production_from: z.date().nullable(),
  production_to: z.date().nullable(),
  steering: z.enum(FITMENT_STEERING_SIDES).nullable(),
  gearbox: z.enum(FITMENT_GEARBOX_TYPES).nullable(),
  source: z.string(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
});

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminListFitmentsType>,
  res: MedusaResponse,
): Promise<void> {
  const filters = req.validatedQuery as AdminListFitmentsType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const fitments = await catalog.listFitments(filters);

  res.json({ fitments: z.array(fitmentSchema).parse(fitments) });
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateFitmentType>,
  res: MedusaResponse,
): Promise<void> {
  const body = req.validatedBody;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await catalog.retrieveVehicle(body.vehicle_id);
  await catalog.retrievePart(body.part_id);

  const fitment = await catalog.createFitments({
    ...body,
    created_by: req.auth_context.actor_id,
    updated_by: req.auth_context.actor_id,
  });

  res.json({ fitment: fitmentSchema.parse(fitment) });
}
