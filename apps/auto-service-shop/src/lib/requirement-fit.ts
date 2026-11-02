import {
  attributeValuesSchema,
  requirementMatches,
  type Vehicle,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { keysetPages } from '../modules/_shared/keyset-pages';
import type CatalogModuleService from '../modules/catalog/service';
import type { PartFit } from '../modules/publish/service';
import { listVehicleResponses } from './store-response';

const partSchema = z.object({
  id: z.string(),
  category_id: z.string().nullable(),
  attributes: attributeValuesSchema,
});

export type FitPart = z.infer<typeof partSchema>;

export type RequirementFit = {
  part_id: string;
  category_id: string;
  vehicle: Vehicle;
};

const distinct = (values: (string | null)[]) => [
  ...new Set(values.filter((value) => value !== null)),
];

async function vehiclesRequiring(
  catalog: CatalogModuleService,
  categoryIds?: string[],
): Promise<Vehicle[]> {
  const fieldIds =
    categoryIds &&
    (
      await catalog.listCategoryFields(
        { category_id: categoryIds },
        { select: ['id'], take: null },
      )
    ).map(({ id }) => id);
  if (fieldIds?.length === 0) return [];
  const requirements = await catalog.listRequirements(
    fieldIds ? { field_id: fieldIds } : {},
    { select: ['vehicle_id', 'engine_id', 'chassis_id'], take: null },
  );
  const chassisIds = distinct(requirements.map(({ chassis_id }) => chassis_id));
  const modelIds = chassisIds.length
    ? (
        await catalog.listVehicleModels(
          { chassis_id: chassisIds },
          { select: ['id'], take: null },
        )
      ).map(({ id }) => id)
    : [];
  const owners = Object.entries({
    id: distinct(requirements.map(({ vehicle_id }) => vehicle_id)),
    engine_id: distinct(requirements.map(({ engine_id }) => engine_id)),
    model_id: modelIds,
  })
    .filter(([, ids]) => ids.length)
    .map(([key, ids]) => ({ [key]: ids }));
  return owners.length ? listVehicleResponses(catalog, { $or: owners }) : [];
}

const fitsOf = (vehicles: Vehicle[], parts: FitPart[]): RequirementFit[] => {
  const alike = new Map<string, Vehicle[]>();
  for (const vehicle of vehicles) {
    const key = vehicle.requirements
      .map(({ id }) => id)
      .sort()
      .join();
    const group = alike.get(key);
    if (group) group.push(vehicle);
    else alike.set(key, [vehicle]);
  }
  return [...alike.values()].flatMap((group) =>
    requirementMatches(parts, group[0].requirements).flatMap(
      ({ category_id, parts: matched }) =>
        matched.flatMap(({ id }) =>
          group.map((vehicle) => ({ part_id: id, category_id, vehicle })),
        ),
    ),
  );
};

export async function requirementFits(
  catalog: CatalogModuleService,
  parts: FitPart[],
): Promise<RequirementFit[]> {
  const categoryIds = distinct(parts.map(({ category_id }) => category_id));
  return categoryIds.length
    ? fitsOf(await vehiclesRequiring(catalog, categoryIds), parts)
    : [];
}

export async function everyRequirementFit(
  catalog: CatalogModuleService,
): Promise<PartFit[]> {
  const vehicles = await vehiclesRequiring(catalog);
  const categoryIds = distinct(
    vehicles.flatMap(({ requirements }) =>
      requirements.map(({ category_id }) => category_id),
    ),
  );
  if (!categoryIds.length) return [];
  // TODO: the pairs ride to LISTED_PART_COUNTS as bound arrays; past about a million, persist them at Publish instead
  const fits: PartFit[] = [];
  for await (const rows of keysetPages((after, take) =>
    catalog.listParts(
      { category_id: categoryIds, ...(after && { id: { $gt: after } }) },
      {
        select: ['id', 'category_id', 'attributes'],
        order: { id: 'ASC' },
        take,
      },
    ),
  )) {
    fits.push(
      ...fitsOf(vehicles, z.array(partSchema).parse(rows)).map(
        ({ part_id, category_id, vehicle }) => ({
          part_id,
          category_id,
          vehicle_id: vehicle.id,
        }),
      ),
    );
  }
  return fits;
}
