import { completeCartWorkflow } from '@medusajs/medusa/core-flows';

import { refuseCheckout } from '../../lib/offer-cart';

completeCartWorkflow.hooks.validate(({ cart }, { container }) =>
  refuseCheckout(container, cart),
);
