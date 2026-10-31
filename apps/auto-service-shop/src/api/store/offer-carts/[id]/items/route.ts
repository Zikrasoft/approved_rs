import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { addOffer } from '../../../../../lib/offer-cart';
import type { StoreAddOfferCartItemType } from '../../../validators';

export async function POST(
  req: MedusaRequest<StoreAddOfferCartItemType>,
  res: MedusaResponse,
): Promise<void> {
  const { offer_id, quantity } = req.validatedBody;
  res.json({
    cart: await addOffer(req.scope, req.params.id, offer_id, quantity),
  });
}
