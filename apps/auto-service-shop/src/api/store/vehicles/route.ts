import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { vehiclesResponseSchema } from '@podbor/catalog-contract';

import { listVehiclePage } from '../../../lib/store-response';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import type { StoreListVehiclesType } from '../validators';

export async function GET(
  req: MedusaRequest<unknown, StoreListVehiclesType>,
  res: MedusaResponse,
): Promise<void> {
  const { after, limit, make, model } =
    req.validatedQuery as StoreListVehiclesType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const page = await listVehiclePage(catalog, {
    makeSlug: make,
    modelSlug: model,
    after,
    limit,
  });

  res.json(vehiclesResponseSchema.parse({ ...page, limit }));
}
