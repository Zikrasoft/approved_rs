import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { z } from 'zod';

import {
  partResponseSchema,
  withComputedPrices,
} from '../../../modules/part/store-response';

const querySchema = z.object({
  q: z.string().min(1),
});

const PART_FIELDS = [
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

  res.json({ part: partResponseSchema.parse(withComputedPrices(part)) });
}
