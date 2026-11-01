import type { SearchFilters } from '@medusajs/framework/types';
import {
  attributeValuesSchema,
  requirementMatches,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import type CatalogModuleService from '../modules/catalog/service';
import { listVehicleResponses } from './store-response';

const partsSchema = z.array(
  z.object({
    id: z.string(),
    category_id: z.string().nullable(),
    attributes: attributeValuesSchema,
  }),
);

type VehicleFilter = Parameters<CatalogModuleService['listVehicles']>[0];

async function requirementFittedPartIds(
  catalog: CatalogModuleService,
  vehicles: VehicleFilter,
  categoryId?: string,
): Promise<string[]> {
  const cars = (await listVehicleResponses(catalog, vehicles)).map(
    ({ requirements }) =>
      requirements.filter(
        ({ category_id }) => !categoryId || category_id === categoryId,
      ),
  );
  const categoryIds = [
    ...new Set(cars.flat().map(({ category_id }) => category_id)),
  ];
  if (!categoryIds.length) return [];
  const parts = partsSchema.parse(
    await catalog.listParts(
      { category_id: categoryIds },
      { select: ['id', 'category_id', 'attributes'], take: null },
    ),
  );
  return [
    ...new Set(
      cars.flatMap((requirements) =>
        requirementMatches(parts, requirements).flatMap((match) =>
          match.parts.map(({ id }) => id),
        ),
      ),
    ),
  ];
}

export async function carFitFilter(
  catalog: CatalogModuleService,
  carKey: string,
  vehicles: VehicleFilter,
  categoryId?: string,
): Promise<SearchFilters> {
  const matched = await requirementFittedPartIds(catalog, vehicles, categoryId);
  // TODO: the matched ids ride in filter_by, so a car matching thousands of Parts by Requirement wants them indexed into `cars` instead
  return matched.length
    ? { $or: [{ cars: carKey }, { part_id: { $in: matched } }] }
    : { cars: carKey };
}
