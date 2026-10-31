import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { partOffersResponseSchema } from '@podbor/catalog-contract';

import { pricesShown } from '../../../../../lib/shop-gate';
import { liveOffers } from '../../../../../lib/suppliers/live-quote';
import { storeOffers } from '../../../../../modules/supplier/pricing';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const offers = pricesShown(req)
    ? await liveOffers(req.scope, { part_identifier_id: req.params.id })
    : [];

  res.json(partOffersResponseSchema.parse({ offers: storeOffers(offers) }));
}
