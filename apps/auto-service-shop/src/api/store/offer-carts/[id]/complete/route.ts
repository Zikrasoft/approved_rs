import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { offerCheckout } from '../../../../../lib/offer-cart';
import type { StoreCompleteOfferCartType } from '../../../validators';

export async function POST(
  req: MedusaRequest<StoreCompleteOfferCartType>,
  res: MedusaResponse,
): Promise<void> {
  res.json({
    order: await offerCheckout(req.scope).checkout(
      req.params.id,
      req.validatedBody,
    ),
  });
}
