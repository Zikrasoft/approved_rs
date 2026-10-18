import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { ICartModuleService } from '@medusajs/framework/types';
import { addToCartWorkflow } from '@medusajs/medusa/core-flows';
import { z } from 'zod';

import { PART_MODULE } from '../../../../../modules/part';
import type PartModuleService from '../../../../../modules/part/service';
import {
  ensureCashAtPickupPaymentSession,
  OFFER_ID_METADATA_KEY,
} from '../../../../../lib/offer-cart';
import { sellPrice } from '../../../../../lib/sell-price';

const paramsSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.object({
  offer_id: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id: cartId } = paramsSchema.parse(req.params);
  const { offer_id: offerId, quantity } = bodySchema.parse(req.body ?? {});

  const partModuleService: PartModuleService = req.scope.resolve(PART_MODULE);
  const offer = await partModuleService.retrieveSupplierOffer(offerId, {
    relations: ['identifier', 'identifier.part', 'supplier'],
  });

  await addToCartWorkflow(req.scope).run({
    input: {
      cart_id: cartId,
      items: [
        {
          title: `${offer.identifier.part.name} (${offer.identifier.brand})`,
          quantity,
          unit_price: sellPrice(
            offer.cost_price,
            offer.supplier.markup_percentage,
          ),
          requires_shipping: false,
          metadata: {
            [OFFER_ID_METADATA_KEY]: offer.id,
            supplier: offer.supplier.name,
            part_identifier_id: offer.identifier.id,
          },
        },
      ],
    },
  });

  await ensureCashAtPickupPaymentSession(req.scope, cartId);

  const cartModuleService: ICartModuleService = req.scope.resolve(Modules.CART);
  const cart = await cartModuleService.retrieveCart(cartId, {
    relations: ['items', 'payment_collection'],
  });

  res.json({ cart });
}
