import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { orderLeadSync } from '../../../../../lib/order-lead-sync';
import type { OrderOutcomeType } from '../../../validators';

export async function POST(
  req: MedusaRequest<OrderOutcomeType>,
  res: MedusaResponse,
): Promise<void> {
  const settlement = await orderLeadSync(req.scope).settleFromCrm(
    req.params.id,
    req.validatedBody.outcome,
  );
  if ('conflict' in settlement) {
    res.status(409).json({
      type: 'conflict',
      message: `Order ${req.params.id} is already ${settlement.conflict}`,
    });
    return;
  }
  res.json({ status: settlement.settled });
}
