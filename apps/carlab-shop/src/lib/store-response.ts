import { z } from 'zod';

import { PART_IDENTIFIER_TYPES } from '../modules/catalog/models/part-identifier';
import { sellPrice } from '../modules/supplier/pricing';

export const PART_WITH_OFFERS_FIELDS = [
  'id',
  'name',
  'identifiers.id',
  'identifiers.type',
  'identifiers.brand',
  'identifiers.value',
  'identifiers.offers.id',
  'identifiers.offers.supplier.name',
  'identifiers.offers.supplier.markup_percentage',
  'identifiers.offers.supplier_article_id',
  'identifiers.offers.cost_price',
  'identifiers.offers.stock_quantity',
  'identifiers.offers.lead_time',
];

export const offerSchema = z.object({
  id: z.string(),
  supplier: z.string(),
  supplier_article_id: z.string(),
  price: z.number(),
  stock_quantity: z.number(),
  lead_time: z.string(),
});

export const identifierSchema = z.object({
  id: z.string(),
  type: z.enum(PART_IDENTIFIER_TYPES),
  brand: z.string(),
  value: z.string(),
  offers: z.array(offerSchema),
});

export const partResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifiers: z.array(identifierSchema),
});

export const vehicleResponseSchema = z.object({
  id: z.string(),
  make: z.string(),
  model: z.string(),
  engine_code: z.string(),
  year_from: z.number().nullable(),
  year_to: z.number().nullable(),
});

export type VehicleResponse = z.infer<typeof vehicleResponseSchema>;

const rawPartSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifiers: z.array(
    identifierSchema.extend({
      offers: z
        .array(
          offerSchema.omit({ supplier: true, price: true }).extend({
            cost_price: z.number(),
            supplier: z.object({
              name: z.string(),
              markup_percentage: z.number(),
            }),
          }),
        )
        .nullish(),
    }),
  ),
});

export const toPartResponse = (row: unknown) => {
  const part = rawPartSchema.parse(row);
  return partResponseSchema.parse({
    ...part,
    identifiers: part.identifiers.map((identifier) => ({
      ...identifier,
      offers: (identifier.offers ?? []).map(
        ({ cost_price, supplier, ...offer }) => ({
          ...offer,
          supplier: supplier.name,
          price: sellPrice(cost_price, supplier.markup_percentage),
        }),
      ),
    })),
  });
};
