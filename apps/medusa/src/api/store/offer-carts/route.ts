import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { createCartWorkflow } from '@medusajs/medusa/core-flows';
import { z } from 'zod';

import { CASH_AT_PICKUP_METADATA } from '../../../lib/offer-cart';

const bodySchema = z.object({
  email: z.string().email().optional(),
});

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { email } = bodySchema.parse(req.body ?? {});

  const { result: cart } = await createCartWorkflow(req.scope).run({
    input: {
      email,
      metadata: CASH_AT_PICKUP_METADATA,
    },
  });

  res.json({ cart });
}
