import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import {
  removeOfferLine,
  setOfferQuantity,
} from '../../../../../../lib/offer-cart';
import type { StoreSetOfferCartItemType } from '../../../../validators';

export async function POST(
  req: MedusaRequest<StoreSetOfferCartItemType>,
  res: MedusaResponse,
): Promise<void> {
  const { id, item_id } = req.params;
  res.json({
    cart: await setOfferQuantity(
      req.scope,
      id,
      item_id,
      req.validatedBody.quantity,
    ),
  });
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, item_id } = req.params;
  res.json({ cart: await removeOfferLine(req.scope, id, item_id) });
}
