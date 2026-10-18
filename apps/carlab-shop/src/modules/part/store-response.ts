import { z } from 'zod';

import { PART_IDENTIFIER_TYPES } from './models/part-identifier';

export const PART_WITH_OFFERS_RELATIONS = [
  'identifiers',
  'identifiers.offers',
  'identifiers.offers.supplier',
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

export const sellPrice = (
  costPrice: number,
  markupPercentage: number,
): number => Math.round(costPrice * (1 + markupPercentage / 100));

type RawOffer = {
  cost_price: number;
  supplier: { name: string; markup_percentage: number };
  [key: string]: unknown;
};

type RawIdentifier = {
  offers: RawOffer[];
  [key: string]: unknown;
};

type RawPart = {
  identifiers: RawIdentifier[];
  [key: string]: unknown;
};

export const withComputedPrices = <T extends RawPart>(part: T) => ({
  ...part,
  identifiers: part.identifiers.map((identifier) => ({
    ...identifier,
    offers: identifier.offers.map((offer) => ({
      ...offer,
      supplier: offer.supplier.name,
      price: sellPrice(offer.cost_price, offer.supplier.markup_percentage),
    })),
  })),
});
