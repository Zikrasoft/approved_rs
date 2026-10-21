import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { ICartModuleService } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { completeCartWorkflow } from '@medusajs/medusa/core-flows';

import type { StoreCompleteOfferCartType } from '../../../validators';

export async function POST(
  req: MedusaRequest<StoreCompleteOfferCartType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const carts: ICartModuleService = req.scope.resolve(Modules.CART);
  const cart = await carts.retrieveCart(id);
  await carts.updateCarts(id, {
    metadata: { ...cart.metadata, ...req.validatedBody },
  });

  const { result } = await completeCartWorkflow(req.scope).run({
    input: { id },
  });

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [order],
  } = await query.graph({
    entity: 'order',
    filters: { id: result.id },
    fields: ['id', 'display_id'],
  });

  res.json({ order: { id: order.id, display_id: order.display_id } });
}
