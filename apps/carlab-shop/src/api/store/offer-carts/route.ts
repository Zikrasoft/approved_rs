import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { createCartWorkflow } from '@medusajs/medusa/core-flows';

import {
  addOffer,
  CASH_AT_PICKUP_METADATA,
  sellableOffer,
  syncOfferCart,
} from '../../../lib/offer-cart';
import type { StoreCreateOfferCartType } from '../validators';

export async function POST(
  req: MedusaRequest<StoreCreateOfferCartType>,
  res: MedusaResponse,
): Promise<void> {
  const { email, offer_id, quantity } = req.validatedBody;
  if (offer_id) {
    await sellableOffer(req.scope, offer_id, quantity);
  }

  const { result } = await createCartWorkflow(req.scope).run({
    input: {
      email,
      metadata: CASH_AT_PICKUP_METADATA,
    },
  });

  if (offer_id) {
    await addOffer(req.scope, result.id, offer_id, quantity);
  }
  res.json({
    cart: await syncOfferCart(req.scope, result.id, Boolean(offer_id)),
  });
}
