import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError, Modules } from '@medusajs/framework/utils';

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
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      `Order ${order.id} is ${order.status}, not completed`,
    );
  }
  res.json({
    summary: await orderCaseSummary(
      req.scope,
      await readLeadOrder(req.scope, order.id),
    ),
  });
}
