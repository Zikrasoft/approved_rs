import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MathBN, Modules } from '@medusajs/framework/utils';
import type { ICartModuleService } from '@medusajs/framework/types';
import { updateLineItemInCartWorkflow } from '@medusajs/medusa/core-flows';
import { z } from 'zod';

import { PART_MODULE } from '../../../../../modules/part';
import type PartModuleService from '../../../../../modules/part/service';
import {
  ensureCashAtPickupPaymentSession,
  offerIdOf,
} from '../../../../../lib/offer-cart';

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id: cartId } = paramsSchema.parse(req.params);

  const cartModuleService: ICartModuleService = req.scope.resolve(Modules.CART);
  const cart = await cartModuleService.retrieveCart(cartId, {
    relations: ['items'],
  });

  const offerIds = (cart.items ?? [])
    .map((item) => offerIdOf(item))
    .filter((id): id is string => !!id);

  const partModuleService: PartModuleService = req.scope.resolve(PART_MODULE);
  const offers = offerIds.length
    ? await partModuleService.listSupplierOffers({ id: offerIds })
    : [];
  const currentPriceByOfferId = new Map(
    offers.map((offer) => [offer.id, offer.price]),
  );

  const repriced: string[] = [];
  for (const item of cart.items ?? []) {
    const offerId = offerIdOf(item);
    if (!offerId) {
      continue;
    }
    const currentPrice = currentPriceByOfferId.get(offerId);
    if (
      currentPrice === undefined ||
      MathBN.eq(currentPrice, item.unit_price)
    ) {
      continue;
    }

    await updateLineItemInCartWorkflow(req.scope).run({
      input: {
        cart_id: cartId,
        item_id: item.id,
        update: { unit_price: currentPrice },
      },
    });
    repriced.push(item.id);
  }

  if (repriced.length) {
    await ensureCashAtPickupPaymentSession(req.scope, cartId);
  }

  const updatedCart = await cartModuleService.retrieveCart(cartId, {
    relations: ['items', 'payment_collection'],
  });

  res.json({ cart: updatedCart, repriced_item_ids: repriced });
}
