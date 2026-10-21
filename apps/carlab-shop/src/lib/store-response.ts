import {
  partOfferSchema,
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
];

export const listVehicleResponses = async (
  catalog: CatalogModuleService,
  filters: Parameters<CatalogModuleService['listVehicles']>[0] = {},
): Promise<Vehicle[]> =>
  z
    .array(vehicleSchema)
    .parse(
      await catalog.listVehicles(filters, { relations: VEHICLE_RELATIONS }),
    );

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
