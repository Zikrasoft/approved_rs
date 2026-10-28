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
  const modelIds = model
    ? (await catalog.listVehicleModels({ slug: model })).map(({ id }) => id)
    : null;

  const page =
    modelIds?.length === 0
      ? { vehicles: [], count: 0 }
      : await listVehiclePage(catalog, modelIds ? { model_id: modelIds } : {}, {
          offset,
          limit,
        });

  res.json(vehiclesResponseSchema.parse({ ...page, offset, limit }));
}
