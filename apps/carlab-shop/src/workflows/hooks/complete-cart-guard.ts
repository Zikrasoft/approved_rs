import { completeCartWorkflow } from '@medusajs/medusa/core-flows';
import {
  type CheckoutRefusal,
  checkoutContactSchema,
} from '@podbor/catalog-contract';

import {
  checkoutRefusal,
  type OfferCartLineItem,
  refuse,
} from '../../lib/offer-cart';

const REFUSAL_MESSAGES: Record<
  Exclude<CheckoutRefusal, 'CONTACT_MISSING'>,
  string
> = {
  OFFER_MISSING: 'A line in the cart has no offer that can be sold now.',
  OFFER_OUT_OF_STOCK: 'The supplier no longer has enough of a line in stock.',
  OFFER_PRICE_CHANGED:
    'The price changed for a line in the cart. Reprice the cart before completing checkout.',
};

completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  if (!checkoutContactSchema.safeParse(cart.metadata ?? {}).success) {
    refuse('CONTACT_MISSING', 'The order has no contact.');
  }
  const refusal = await checkoutRefusal(
    container,
    (cart.items ?? []) as OfferCartLineItem[],
  );
  if (refusal) {
    refuse(refusal, REFUSAL_MESSAGES[refusal]);
  }
});
