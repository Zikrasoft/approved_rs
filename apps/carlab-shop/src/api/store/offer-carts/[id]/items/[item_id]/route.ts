import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  removeOfferLine,
  syncOfferCart,
} from '../../../../../../lib/offer-cart';

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, item_id } = req.params;

  await removeOfferLine(req.scope, id, item_id);

  res.json({ cart: await syncOfferCart(req.scope, id, true) });
}
