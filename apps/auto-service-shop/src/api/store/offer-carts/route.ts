import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { createOfferCart } from '../../../lib/offer-cart';
import type { StoreCreateOfferCartType } from '../validators';

export async function POST(
  req: MedusaRequest<StoreCreateOfferCartType>,
  res: MedusaResponse,
): Promise<void> {
  res.json({ cart: await createOfferCart(req.scope, req.validatedBody) });
}
