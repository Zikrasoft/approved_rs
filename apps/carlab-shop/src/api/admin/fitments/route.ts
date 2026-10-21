import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';

import { fitmentRowSchema } from '../../../lib/store-response';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import type {
  AdminCreateFitmentType,
  AdminListFitmentsType,
} from '../validators';

const adminFitmentSchema = fitmentRowSchema.extend({
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

  const fitments = await catalog.listFitments(filters, { take: null });

  res.json({ fitments: z.array(adminFitmentSchema).parse(fitments) });
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateFitmentType>,
  res: MedusaResponse,
): Promise<void> {
  const { part_id, vehicle_id, ...conditions } = req.validatedBody;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await catalog.retrieveVehicle(vehicle_id);
  const {
    created: [fitment],
  } = await catalog.attachPartToVehicles(
    part_id,
    { vehicle_id },
    {
      ...conditions,
      created_by: req.auth_context.actor_id,
      updated_by: req.auth_context.actor_id,
    },
  );
  if (!fitment) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      'This Part already fits this Vehicle at that position and criteria',
    );
  }

  res.json({
    fitment: adminFitmentSchema.parse(
      await catalog.retrieveFitment(fitment.id),
    ),
  });
}
