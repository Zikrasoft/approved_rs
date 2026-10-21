import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { deleteLineItemsWorkflow } from '@medusajs/medusa/core-flows';

import {
  setOfferQuantity,
  syncOfferCart,
} from '../../../../../../lib/offer-cart';
import type { StoreSetOfferCartItemType } from '../../../../validators';

export async function POST(
  req: MedusaRequest<StoreSetOfferCartItemType>,
  res: MedusaResponse,
): Promise<void> {
  const { id, item_id } = req.params;

  await setOfferQuantity(req.scope, id, item_id, req.validatedBody.quantity);

  res.json({ cart: await syncOfferCart(req.scope, id, true) });
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, item_id } = req.params;

  await deleteLineItemsWorkflow(req.scope).run({
    input: { cart_id: id, ids: [item_id] },
  });

  res.json({ cart: await syncOfferCart(req.scope, id, true) });
}
