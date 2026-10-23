import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import {
  addLineAddon,
  INSTALLATION,
  removeLineAddon,
  syncOfferCart,
} from '../../../../../../../lib/offer-cart';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, item_id } = req.params;

  await addLineAddon(req.scope, id, item_id, INSTALLATION);

  res.json({ cart: await syncOfferCart(req.scope, id, true) });
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, item_id } = req.params;

  await removeLineAddon(req.scope, id, item_id, INSTALLATION);

  res.json({ cart: await syncOfferCart(req.scope, id, true) });
}
