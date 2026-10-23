import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { refuseConflictingFitment } from '../../../../lib/fitment-conflicts';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import type { AdminBulkAttachFitmentsType } from '../../validators';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminBulkAttachFitmentsType>,
  res: MedusaResponse,
): Promise<void> {
  const {
    part_id,
    vehicle_id,
    make_id,
    series_id,
    chassis_id,
    model_id,
    engine_id,
    engine_family,
    year_from,
    year_to,
    confirm_conflicts,
    ...conditions
  } = req.validatedBody;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const filter = {
    vehicle_id,
    make_id,
    series_id,
    chassis_id,
    model_id,
    engine_id,
    engine_family,
    year_from,
    year_to,
  };
  await refuseConflictingFitment(catalog, part_id, filter, confirm_conflicts);
  const { matched, created } = await catalog.attachPartToVehicles(
    part_id,
    filter,
    {
      ...conditions,
      created_by: req.auth_context.actor_id,
      updated_by: req.auth_context.actor_id,
    },
  );

  res.json({ matched, created: created.length });
}
