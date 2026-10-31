import {
  type Fitment,
  fitmentSchema,
  SUPPLIER_VEHICLE_ID,
  type Vehicle,
  vehicleSchema,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import type CatalogModuleService from '../modules/catalog/service';

const VEHICLE_RELATIONS = [
  'model',
  'model.chassis',
  'model.chassis.series',
  'model.chassis.series.make',
  'engine',
  'identifiers',
  ...[
    'requirements',
    'engine.requirements',
    'model.chassis.requirements',
  ].flatMap((owner) => [owner, `${owner}.field`]),
];

const ownedRequirements = z.object({
  requirements: z.array(
    z
      .object({
        id: z.string(),
        option_keys: z.array(z.string()).nullable(),
        min: z.number().nullable(),
        max: z.number().nullable(),
        quantity: z.number(),
        field: z.object({ key: z.string(), category_id: z.string() }),
      })
      .transform(({ field, ...requirement }) => ({
        ...requirement,
        field_key: field.key,
        category_id: field.category_id,
      })),
  ),
});

const inheritedRequirements = ownedRequirements.extend({
  engine: ownedRequirements,
  model: z.object({ chassis: ownedRequirements }),
});

export const VEHICLE_BATCH = 1000;

const VEHICLE_READ = {
  relations: VEHICLE_RELATIONS,
  order: { id: 'ASC' as const },
};

const vehicleRows = async (
  catalog: CatalogModuleService,
  filters: Parameters<CatalogModuleService['listVehicles']>[0],
) => {
  const batch = (skip: number) =>
    catalog.listVehicles(filters, {
      ...VEHICLE_READ,
      skip,
      take: VEHICLE_BATCH,
    });
  const rows: Awaited<ReturnType<typeof batch>> = [];
  for (let skip = 0; ; skip += VEHICLE_BATCH) {
    const next = await batch(skip);
    rows.push(...next);
    if (next.length < VEHICLE_BATCH) {
      return rows;
    }
  }
};

const toVehicleResponse = (
  row: Awaited<ReturnType<CatalogModuleService['listVehicles']>>[number],
): Vehicle => {
  const { requirements, engine, model } = inheritedRequirements.parse(row);
  return vehicleSchema.parse({
    ...row,
    identifiers: row.identifiers.filter(
      ({ type }) => type !== SUPPLIER_VEHICLE_ID,
    ),
    requirements: [
      ...engine.requirements,
      ...model.chassis.requirements,
      ...requirements,
    ],
  });
};

export const listVehicleResponses = async (
  catalog: CatalogModuleService,
  filters: Parameters<CatalogModuleService['listVehicles']>[0] = {},
): Promise<Vehicle[]> =>
  (await vehicleRows(catalog, filters)).map(toVehicleResponse);

export const listVehiclePage = async (
  catalog: CatalogModuleService,
  {
    modelSlug,
    offset,
    limit,
  }: { modelSlug?: string; offset: number; limit: number },
): Promise<{ vehicles: Vehicle[]; count: number }> => {
  const modelIds = modelSlug
    ? (await catalog.listVehicleModels({ slug: modelSlug })).map(({ id }) => id)
    : null;
  if (modelIds?.length === 0) {
    return { vehicles: [], count: 0 };
  }
  const [rows, count] = await catalog.listAndCountVehicles(
    modelIds ? { model_id: modelIds } : {},
    { ...VEHICLE_READ, skip: offset, take: limit },
  );
  return { vehicles: rows.map(toVehicleResponse), count };
};

const isoDate = z
  .date()
  .nullable()
  .transform((date) => date?.toISOString() ?? null);

export const fitmentRowSchema = fitmentSchema.extend({
  production_from: isoDate,
  production_to: isoDate,
});

export const adminFitmentSchema = fitmentRowSchema.extend({
  source: z.string(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  updated_at: z.date(),
});

export const toFitmentResponse = (row: unknown): Fitment =>
  fitmentRowSchema.parse(row);
