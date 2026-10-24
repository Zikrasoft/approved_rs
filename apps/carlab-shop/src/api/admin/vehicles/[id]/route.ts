import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { deleteVehicleWorkflow } from '../../../../workflows/delete-catalog-rows';
import { VEHICLES, itemRoutes } from '../../vehicle-reference-routes';

export const { POST } = itemRoutes(VEHICLES);

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  await catalog.retrieveVehicle(id);
  await deleteVehicleWorkflow(req.scope).run({ input: { id } });
  res.json({ id, object: 'vehicle', deleted: true });
}
