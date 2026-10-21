import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { partOffersResponseSchema } from '@podbor/catalog-contract';

import { liveOffers } from '../../../../../lib/suppliers/live-quote';
import { storeOffers } from '../../../../../modules/supplier/pricing';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const offers = await liveOffers(req.scope, {
    part_identifier_id: req.params.id,
  });

  res.json(partOffersResponseSchema.parse({ offers: storeOffers(offers) }));
}
