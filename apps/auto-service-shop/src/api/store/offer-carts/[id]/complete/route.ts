import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { checkout } from '../../../../../lib/offer-cart';
import type { StoreCompleteOfferCartType } from '../../../validators';

export async function POST(
  req: MedusaRequest<StoreCompleteOfferCartType>,
  res: MedusaResponse,
): Promise<void> {
  res.json({
    order: await checkout(req.scope, req.params.id, req.validatedBody),
  });
}
