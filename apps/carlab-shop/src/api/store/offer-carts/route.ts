import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { createCartWorkflow } from '@medusajs/medusa/core-flows';

import { CASH_AT_PICKUP_METADATA } from '../../../lib/offer-cart';
import type { StoreCreateOfferCartType } from '../validators';

export async function POST(
  req: MedusaRequest<StoreCreateOfferCartType>,
  res: MedusaResponse,
): Promise<void> {
  const { email } = req.validatedBody;

  const { result: cart } = await createCartWorkflow(req.scope).run({
    input: {
      email,
      metadata: CASH_AT_PICKUP_METADATA,
    },
  });

  res.json({ cart });
}
