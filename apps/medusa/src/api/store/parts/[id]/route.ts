import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';

import { PART_MODULE } from '../../../../modules/part';
import { PART_IDENTIFIER_TYPES } from '../../../../modules/part/models/part-identifier';
import type PartModuleService from '../../../../modules/part/service';

const paramsSchema = z.object({
  id: z.string().min(1),
});

const offerSchema = z.object({
  id: z.string(),
  supplier: z.string(),
  supplier_article_id: z.string(),
  price: z.number(),
  stock_quantity: z.number(),
  lead_time: z.string(),
});

const identifierSchema = z.object({
  id: z.string(),
  type: z.enum(PART_IDENTIFIER_TYPES),
  brand: z.string(),
  value: z.string(),
  offers: z.array(offerSchema),
});

const partResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifiers: z.array(identifierSchema),
});

const sellPrice = (costPrice: number, markupPercentage: number): number =>
  Math.round(costPrice * (1 + markupPercentage / 100));

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = paramsSchema.parse(req.params);

  const partModuleService: PartModuleService = req.scope.resolve(PART_MODULE);

  const part = await partModuleService.retrievePart(id, {
    relations: [
      'identifiers',
      'identifiers.offers',
      'identifiers.offers.supplier',
    ],
  });

  const withComputedPrices = {
    ...part,
    identifiers: part.identifiers.map((identifier) => ({
      ...identifier,
      offers: identifier.offers.map((offer) => ({
        ...offer,
        supplier: offer.supplier.name,
        price: sellPrice(offer.cost_price, offer.supplier.markup_percentage),
      })),
    })),
  };

  res.json({ part: partResponseSchema.parse(withComputedPrices) });
}
