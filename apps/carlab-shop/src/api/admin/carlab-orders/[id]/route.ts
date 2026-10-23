import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';

import { readLeadOrder } from '../../../../lib/order-lead';
import { carlabOrderView } from '../../../../lib/order-view';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = await req.scope
    .resolve(Modules.ORDER)
    .retrieveOrder(req.params.id);
  res.json({ order: carlabOrderView(await readLeadOrder(req.scope, id)) });
}
