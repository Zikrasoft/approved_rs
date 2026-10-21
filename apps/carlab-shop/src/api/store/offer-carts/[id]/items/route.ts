import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { ICartModuleService } from '@medusajs/framework/types';
import { addToCartWorkflow } from '@medusajs/medusa/core-flows';

import {
  ensureCashAtPickupPaymentSession,
  OFFER_ID_METADATA_KEY,
} from '../../../../../lib/offer-cart';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../../modules/supplier';
import { sellPrice } from '../../../../../modules/supplier/pricing';
import type SupplierModuleService from '../../../../../modules/supplier/service';
import type { StoreAddOfferCartItemType } from '../../../validators';

export async function POST(
  req: MedusaRequest<StoreAddOfferCartItemType>,
  res: MedusaResponse,
): Promise<void> {
  const { id: cartId } = req.params;
  const { offer_id: offerId, quantity } = req.validatedBody;

  const supplierService: SupplierModuleService =
    req.scope.resolve(SUPPLIER_MODULE);
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const offer = await supplierService.retrieveSupplierOffer(offerId, {
    relations: ['supplier'],
  });
  const identifier = await catalog.retrievePartIdentifier(
    offer.part_identifier_id,
    { relations: ['part'] },
  );

  await addToCartWorkflow(req.scope).run({
    input: {
      cart_id: cartId,
      items: [
        {
          title: `${identifier.part.name} (${identifier.brand})`,
          quantity,
          unit_price: sellPrice(
            offer.cost_price,
            offer.supplier.markup_percentage,
          ),
          requires_shipping: false,
          metadata: {
            [OFFER_ID_METADATA_KEY]: offer.id,
            supplier: offer.supplier.name,
            part_identifier_id: identifier.id,
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
