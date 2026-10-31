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

export const modelsBySlug = async (
  catalog: CatalogModuleService,
  slug: string,
  makeSlug: string | undefined,
  config: Parameters<CatalogModuleService['listVehicleModels']>[1] = {},
) => {
  const makeIds = makeSlug
    ? (await catalog.listMakes({ slug: makeSlug }, { select: ['id'] })).map(
        ({ id }) => id,
      )
    : null;
  return makeIds?.length === 0
    ? []
    : catalog.listVehicleModels(
        { slug, ...(makeIds && { make_id: makeIds }) },
        config,
      );
};

export const listVehiclePage = async (
  catalog: CatalogModuleService,
  {
    makeSlug,
    modelSlug,
    after,
    limit,
  }: {
    makeSlug?: string;
    modelSlug?: string;
    after?: string;
    limit: number;
  },
): Promise<{ vehicles: Vehicle[]; next: string | null }> => {
  const modelIds = modelSlug
    ? (await modelsBySlug(catalog, modelSlug, makeSlug)).map(({ id }) => id)
    : null;
  if (modelIds?.length === 0) {
    return { vehicles: [], next: null };
  }
  const rows = await catalog.listVehicles(
    {
      ...(modelIds && { model_id: modelIds }),
      ...(after && { id: { $gt: after } }),
    },
    { ...VEHICLE_READ, take: limit },
  );
  return {
    vehicles: rows.map(toVehicleResponse),
    next: nextCursor(rows, limit),
  };
};

export const nextCursor = (rows: { id: string }[], limit: number) =>
  rows.length === limit ? rows[rows.length - 1].id : null;

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
