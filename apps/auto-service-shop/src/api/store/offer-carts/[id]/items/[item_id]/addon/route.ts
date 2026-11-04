import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { offerCart } from '../../../../../../../lib/offer-cart';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, item_id } = req.params;
  res.json({ cart: await offerCart(req.scope).addLineAddon(id, item_id) });
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, item_id } = req.params;
  res.json({ cart: await offerCart(req.scope).removeLineAddon(id, item_id) });
}
