import { completeCartWorkflow } from '@medusajs/medusa/core-flows';

import { offerCheckout } from '../../lib/offer-cart';

completeCartWorkflow.hooks.validate(({ cart }, { container }) =>
  offerCheckout(container).refuseCheckout(cart),
);
