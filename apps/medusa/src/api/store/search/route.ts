import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { z } from 'zod';

import { PART_IDENTIFIER_TYPES } from '../../../modules/part/models/part-identifier';

const querySchema = z.object({
  q: z.string().min(1),
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

const PART_FIELDS = [
  'id',
  'name',
  'identifiers.id',
  'identifiers.type',
  'identifiers.brand',
  'identifiers.value',
  'identifiers.offers.id',
  'identifiers.offers.supplier',
  'identifiers.offers.supplier_article_id',
  'identifiers.offers.price',
  'identifiers.offers.stock_quantity',
  'identifiers.offers.lead_time',
];

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { q } = querySchema.parse(req.query);

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.search({
    entity: 'part',
    fields: PART_FIELDS,
    filters: { q },
    pagination: { take: 1 },
  });

  const part = data[0];

  if (!part) {
    res.status(404).json({ part: null });
    return;
  }

  res.json({ part: partResponseSchema.parse(part) });
}
