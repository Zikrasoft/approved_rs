import type {
  BigNumberValue,
  MedusaContainer,
} from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
} from '@medusajs/medusa/core-flows';

export const CASH_AT_PICKUP_PROVIDER_ID = 'pp_system_default';
export const CASH_AT_PICKUP_METADATA = { fulfillment: 'cash_at_pickup' };
export const OFFER_ID_METADATA_KEY = 'offer_id';

export type OfferCartLineItem = {
  id: string;
  unit_price: BigNumberValue;
  metadata?: Record<string, unknown> | null;
};

export function offerIdOf(item: OfferCartLineItem): string | undefined {
  const offerId = item.metadata?.[OFFER_ID_METADATA_KEY];
  return typeof offerId === 'string' ? offerId : undefined;
}

export async function ensureCashAtPickupPaymentSession(
  container: MedusaContainer,
  cartId: string,
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [cart],
  } = await query.graph({
    entity: 'cart',
    filters: { id: cartId },
    fields: ['id', 'payment_collection.id'],
  });

  let paymentCollectionId = cart?.payment_collection?.id;

  if (!paymentCollectionId) {
    const { result } = await createPaymentCollectionForCartWorkflow(
      container,
    ).run({ input: { cart_id: cartId } });
    paymentCollectionId = result.id;
  }

  await createPaymentSessionsWorkflow(container).run({
    input: {
      payment_collection_id: paymentCollectionId,
      provider_id: CASH_AT_PICKUP_PROVIDER_ID,
    },
  });
}
