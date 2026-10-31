import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { ILockingModule } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import {
  cancelOrderWorkflow,
  completeOrderWorkflow,
} from '@medusajs/medusa/core-flows';

import { LEAD_LOST_AT } from '../../../../../lib/order-lead';
import type { OrderOutcomeType } from '../../../validators';

const OUTCOME_LOCK_TIMEOUT_SECONDS = 30;

export async function POST(
  req: MedusaRequest<OrderOutcomeType>,
  res: MedusaResponse,
): Promise<void> {
  const { outcome } = req.validatedBody;
  const orders = req.scope.resolve(Modules.ORDER);
  await req.scope.resolve<ILockingModule>(Modules.LOCKING).execute(
    `order-outcome:${req.params.id}`,
    async () => {
      const order = await orders.retrieveOrder(req.params.id);
      if (order.status === outcome) {
        res.json({ status: outcome });
        return;
      }
      if (order.status === 'completed' || order.status === 'canceled') {
        res.status(409).json({
          type: 'conflict',
          message: `Order ${order.id} is already ${order.status}`,
        });
        return;
      }
      if (outcome === 'completed') {
        await completeOrderWorkflow(req.scope).run({
          input: { orderIds: [order.id] },
        });
      } else {
        await orders.updateOrders(order.id, {
          metadata: {
            ...order.metadata,
            [LEAD_LOST_AT]: new Date().toISOString(),
          },
        });
        try {
          await cancelOrderWorkflow(req.scope).run({
            input: { order_id: order.id },
          });
        } catch (error) {
          await orders.updateOrders(order.id, {
            metadata: { ...order.metadata, [LEAD_LOST_AT]: '' },
          });
          throw error;
        }
      }
      res.json({ status: outcome });
    },
    { timeout: OUTCOME_LOCK_TIMEOUT_SECONDS },
  );
}
