import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import {
  addLineAddon,
  removeLineAddon,
} from '../../../../../../../lib/offer-cart';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, item_id } = req.params;
  res.json({
    cart: await addLineAddon(req.scope, id, item_id, 'installation'),
  });
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, item_id } = req.params;
  res.json({
    cart: await removeLineAddon(req.scope, id, item_id, 'installation'),
  });
}
