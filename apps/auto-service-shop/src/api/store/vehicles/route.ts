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
  const { offset, limit, model } = req.validatedQuery as StoreListVehiclesType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const page = await listVehiclePage(catalog, {
    modelSlug: model,
    offset,
    limit,
  });

  res.json(vehiclesResponseSchema.parse({ ...page, offset, limit }));
}
