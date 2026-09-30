import { MedusaError } from '@medusajs/framework/utils';
import { completeCartWorkflow } from '@medusajs/medusa/core-flows';

import { contactFaults, isBot } from '../../api/store/contact';

export function requireContact(cart: unknown): void {
  if (isBot(cart)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Заказ не принят');
  }
  const faults = contactFaults(cart);
  if (faults.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Не заполнено или заполнено неверно: ${faults.join(', ')}`,
    );
  }
}

completeCartWorkflow.hooks.validate(({ cart }) => requireContact(cart));
