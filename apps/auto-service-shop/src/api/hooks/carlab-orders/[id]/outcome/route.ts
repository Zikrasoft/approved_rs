import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError, Modules } from '@medusajs/framework/utils';
import {
  cancelOrderWorkflow,
  completeOrderWorkflow,
} from '@medusajs/medusa/core-flows';

import { LEAD_LOST_AT } from '../../../../../lib/order-lead';
import type { OrderOutcomeType } from '../../../validators';

export async function POST(
  req: MedusaRequest<OrderOutcomeType>,
  res: MedusaResponse,
): Promise<void> {
  const { outcome } = req.validatedBody;
  const orders = req.scope.resolve(Modules.ORDER);
  const order = await orders.retrieveOrder(req.params.id);
  if (order.status === outcome) {
    res.json({ status: outcome });
    return;
  }
  if (order.status === 'completed' || order.status === 'canceled') {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      `Order ${order.id} is already ${order.status}`,
    );
  }
  if (outcome === 'completed') {
    await completeOrderWorkflow(req.scope).run({
      input: { orderIds: [order.id] },
    });
  } else {
    await orders.updateOrders(order.id, {
      metadata: { ...order.metadata, [LEAD_LOST_AT]: new Date().toISOString() },
    });
    await cancelOrderWorkflow(req.scope).run({
      input: { order_id: order.id },
    });
  }
  res.json({ status: outcome });
}
