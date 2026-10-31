import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { offerCart } from '../../../../../lib/offer-cart';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.json({ cart: await offerCart(req.scope).readOfferCart(req.params.id) });
}
