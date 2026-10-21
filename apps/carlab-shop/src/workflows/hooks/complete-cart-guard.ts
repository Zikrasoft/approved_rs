import { MathBN, MedusaError } from '@medusajs/framework/utils';
import { completeCartWorkflow } from '@medusajs/medusa/core-flows';

import { offerIdOf, type OfferCartLineItem } from '../../lib/offer-cart';
import { SUPPLIER_MODULE } from '../../modules/supplier';
import { sellPrice } from '../../modules/supplier/pricing';
import type SupplierModuleService from '../../modules/supplier/service';

export const OFFER_PRICE_CHANGED_CODE = 'OFFER_PRICE_CHANGED';

export function findMissingOrRepricedItems(
  items: OfferCartLineItem[],
  currentPriceByOfferId: Map<string, number>,
): OfferCartLineItem[] {
  return items.filter((item) => {
    const offerId = offerIdOf(item);
    if (!offerId) {
      return false;
    }
    const currentPrice = currentPriceByOfferId.get(offerId);
    return (
      currentPrice === undefined || !MathBN.eq(currentPrice, item.unit_price)
    );
  });
}

completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const items = (cart.items ?? []) as OfferCartLineItem[];
  const offerIds = items.map(offerIdOf).filter((id): id is string => !!id);

  if (!offerIds.length) {
    return;
  }

  const supplierService: SupplierModuleService =
    container.resolve(SUPPLIER_MODULE);
  const offers = await supplierService.listSupplierOffers(
    { id: offerIds },
    { relations: ['supplier'] },
  );
  const currentPriceByOfferId = new Map(
    offers.map((offer) => [
      offer.id,
      sellPrice(offer.cost_price, offer.supplier.markup_percentage),
    ]),
  );

  const stale = findMissingOrRepricedItems(items, currentPriceByOfferId);
  if (stale.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `The price changed for ${stale.length} item(s) in the cart. Reprice the cart before completing checkout.`,
      OFFER_PRICE_CHANGED_CODE,
    );
  }
});
