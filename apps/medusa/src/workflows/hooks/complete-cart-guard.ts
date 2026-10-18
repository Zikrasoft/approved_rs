import { MathBN, MedusaError } from '@medusajs/framework/utils';
import { completeCartWorkflow } from '@medusajs/medusa/core-flows';

import { PART_MODULE } from '../../modules/part';
import type PartModuleService from '../../modules/part/service';
import { offerIdOf, type OfferCartLineItem } from '../../lib/offer-cart';
import { sellPrice } from '../../lib/sell-price';

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

  const partModuleService: PartModuleService = container.resolve(PART_MODULE);
  const offers = await partModuleService.listSupplierOffers(
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
