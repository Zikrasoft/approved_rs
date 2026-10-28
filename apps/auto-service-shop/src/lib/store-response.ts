import {
  type Fitment,
  fitmentSchema,
  partOfferSchema,
  SUPPLIER_VEHICLE_ID,
  type Vehicle,
  vehicleSchema,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { PART_IDENTIFIER_TYPES } from '../modules/catalog/models/part-identifier';
import type CatalogModuleService from '../modules/catalog/service';
import { storeOffers } from '../modules/supplier/pricing';

export const PART_WITH_OFFERS_FIELDS = [
  'id',
  'name',
  'identifiers.id',
  'identifiers.type',
  'identifiers.brand.name',
  'identifiers.value',
  'identifiers.offers.id',
  'identifiers.offers.supplier.markup_percentage',
  'identifiers.offers.cost_price',
  'identifiers.offers.currency',
  'identifiers.offers.stock_quantity',
  'identifiers.offers.lead_time_days',
];

const offerRowSchema = z.object({
  id: z.string(),
  cost_price: z.number(),
  currency: z.string(),
  stock_quantity: z.number(),
  lead_time_days: z.number(),
  supplier: z.object({ markup_percentage: z.number() }),
});

export const identifierSchema = z.object({
  id: z.string(),
  type: z.enum(PART_IDENTIFIER_TYPES),
  brand: z.string(),
  value: z.string(),
  offers: z.array(partOfferSchema),
});

export const partResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifiers: z.array(identifierSchema),
});

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

export const listVehicleResponses = async (
  catalog: CatalogModuleService,
  filters: Parameters<CatalogModuleService['listVehicles']>[0] = {},
): Promise<Vehicle[]> =>
  (
    await catalog.listVehicles(filters, {
      relations: VEHICLE_RELATIONS,
      take: null,
    })
  ).map((row) => {
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
  });

const rawPartSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifiers: z.array(
    identifierSchema.extend({
      brand: z.object({ name: z.string() }),
      offers: z.array(offerRowSchema).nullish(),
    }),
  ),
});

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

export const toPartResponse = (row: unknown) => {
  const part = rawPartSchema.parse(row);
  return partResponseSchema.parse({
    ...part,
    identifiers: part.identifiers.map((identifier) => ({
      ...identifier,
      brand: identifier.brand.name,
      offers: storeOffers(identifier.offers ?? []),
    })),
  });
};
