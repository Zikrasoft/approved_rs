import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';

import { adminFitmentSchema } from '../../../lib/store-response';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import type {
  AdminCreateFitmentType,
  AdminListFitmentsType,
} from '../validators';
import { adminError } from '../../../lib/admin-errors';
import { withEditors } from '../../../lib/editors';
import { refuseConflictingFitment } from '../../../lib/fitment-conflicts';

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminListFitmentsType>,
  res: MedusaResponse,
): Promise<void> {
  const filters = req.validatedQuery as AdminListFitmentsType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const fitments = await catalog.listFitments(filters, { take: null });

  res.json({
    fitments: await withEditors(
      req.scope,
      z.array(adminFitmentSchema).parse(fitments),
    ),
  });
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateFitmentType>,
  res: MedusaResponse,
): Promise<void> {
  const { part_id, vehicle_id, confirm_conflicts, ...conditions } =
    req.validatedBody;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await catalog.retrieveVehicle(vehicle_id);
  await refuseConflictingFitment(
    catalog,
    part_id,
    { vehicle_id },
    confirm_conflicts,
  );
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
    throw adminError(
      MedusaError.Types.CONFLICT,
      'DUPLICATE_FITMENT',
      'This Part already fits this Vehicle at that position and criteria',
    );
  }

  res.json({
    fitment: adminFitmentSchema.parse(
      await catalog.retrieveFitment(fitment.id),
    ),
  });
}
