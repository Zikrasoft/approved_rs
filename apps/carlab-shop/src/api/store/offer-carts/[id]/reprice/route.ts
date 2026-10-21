import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { syncOfferCart } from '../../../../../lib/offer-cart';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json({ cart: await syncOfferCart(req.scope, req.params.id) });
}
