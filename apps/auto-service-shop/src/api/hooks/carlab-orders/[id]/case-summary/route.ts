import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';

import { orderCaseSummary } from '../../../../../lib/order-case';
import { readLeadOrder } from '../../../../../lib/order-lead';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const order = await req.scope
    .resolve(Modules.ORDER)
    .retrieveOrder(req.params.id);
  if (order.status !== 'completed') {
    res.status(409).json({
      type: 'conflict',
      message: `Order ${order.id} is ${order.status}, not completed`,
    });
    return;
  }
  res.json({
    summary: await orderCaseSummary(
      req.scope,
      await readLeadOrder(req.scope, order.id),
    ),
  });
}
