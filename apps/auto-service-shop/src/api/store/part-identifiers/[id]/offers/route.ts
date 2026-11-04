import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { partOffersResponseSchema } from '@podbor/catalog-contract';

import { pricesShown } from '../../../../../lib/shop-gate';
import { sellingOffers } from '../../../../../lib/suppliers/live-quote';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const offers = pricesShown(req)
    ? await sellingOffers(
        req.scope,
        { part_identifier_id: req.params.id },
        { reuseRecent: true },
      )
    : [];

  res.json(partOffersResponseSchema.parse({ offers }));
}
