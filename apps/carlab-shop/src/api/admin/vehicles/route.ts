import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import type { NewVehicle } from '../../../modules/catalog/service';
import { VEHICLES, collectionRoutes } from '../vehicle-reference-routes';

export const { GET } = collectionRoutes(VEHICLES);

export async function POST(
  req: AuthenticatedMedusaRequest<NewVehicle>,
  res: MedusaResponse,
): Promise<void> {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const vehicle = await catalog.createVehicleOnce({
    ...req.validatedBody,
    created_by: req.auth_context.actor_id,
    updated_by: req.auth_context.actor_id,
  });
  res.json({ vehicle });
}
