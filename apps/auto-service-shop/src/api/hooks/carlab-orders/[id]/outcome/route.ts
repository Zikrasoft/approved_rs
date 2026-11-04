import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { ORDER_MISSING } from '@podbor/lead-crm/shop-orders-wire';

import { orderLeadSync } from '../../../../../lib/order-lead-sync';
import type { OrderOutcomeType } from '../../../validators';

const orderMissing = (error: unknown) =>
  MedusaError.isMedusaError(error) &&
  error.type === MedusaError.Types.NOT_FOUND;

export async function POST(
  req: MedusaRequest<OrderOutcomeType>,
  res: MedusaResponse,
): Promise<void> {
  const settlement = await orderLeadSync(req.scope)
    .settleFromCrm(req.params.id, req.validatedBody.outcome)
    .catch((error: unknown) => {
      if (orderMissing(error)) return null;
      throw error;
    });
  if (!settlement) {
    res.status(404).json({
      type: ORDER_MISSING,
      message: `Order ${req.params.id} does not exist`,
    });
    return;
  }
  if ('conflict' in settlement) {
    res.status(409).json({
      type: 'conflict',
      message: `Order ${req.params.id} is already ${settlement.conflict}`,
    });
    return;
  }
  res.json({ status: settlement.settled });
}
