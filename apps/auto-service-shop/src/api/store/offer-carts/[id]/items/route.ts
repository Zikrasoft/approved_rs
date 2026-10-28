import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { addOffer, syncOfferCart } from '../../../../../lib/offer-cart';
import type { StoreAddOfferCartItemType } from '../../../validators';

export async function POST(
  req: MedusaRequest<StoreAddOfferCartItemType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const { offer_id, quantity } = req.validatedBody;

  await addOffer(req.scope, id, offer_id, quantity);

  res.json({ cart: await syncOfferCart(req.scope, id, true) });
}
