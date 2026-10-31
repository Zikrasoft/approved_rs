import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { readOfferCart } from '../../../../../lib/offer-cart';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json({ cart: await readOfferCart(req.scope, req.params.id) });
}
