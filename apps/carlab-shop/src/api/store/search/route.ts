import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { SearchFilters } from '@medusajs/framework/types';

import {
  PART_WITH_OFFERS_FIELDS,
  toPartResponse,
} from '../../../lib/store-response';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import type { StoreSearchPartsType } from '../validators';

export async function GET(
  req: MedusaRequest<unknown, StoreSearchPartsType>,
  res: MedusaResponse,
): Promise<void> {
  const { q, vehicle_id } = req.validatedQuery as StoreSearchPartsType;

  const filters: SearchFilters = { q };

  if (vehicle_id) {
    const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

    await catalog.retrieveVehicle(vehicle_id);

    const fitments = await catalog.listFitments({ vehicle_id });
    const partIds = [...new Set(fitments.map((fitment) => fitment.part_id))];

    if (!partIds.length) {
      res.status(404).json({ part: null });
      return;
    }

    filters.id = { $in: partIds };
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.search({
    entity: 'part',
    fields: PART_WITH_OFFERS_FIELDS,
    filters,
    pagination: { take: 1 },
  });

  const part = data[0];

  if (!part) {
    res.status(404).json({ part: null });
    return;
  }

  res.json({ part: toPartResponse(part) });
}
