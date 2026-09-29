import {
  CART_METADATA,
  PAYMENT_PROVIDER,
  PICKUP_OPTION_CODE,
  SHOP_COUNTRY,
} from '@podbor/shop-catalog/browser';
import type { TrackedContactChannel } from '@podbor/lead-crm/contact-channel';
import { CART_FIELDS, carts, type Cart } from './cartApi';
import { storeJson } from './store';

export { retrieveCart } from './cartApi';

export interface Contact {
  name: string;
  email: string;
  phone: string;
  channel: TrackedContactChannel;
  comment: string;
  website: string;
}

export interface PlacedOrder {
  id: string;
  display_id: number;
  total: number;
}

export class NoPickupError extends Error {}

export class CompletionError extends Error {}

export const saveContact = async (
  cartId: string,
  contact: Contact,
): Promise<Cart> =>
  (
    await storeJson<{ cart: Cart }>(carts(cartId), {
      method: 'POST',
      params: { fields: CART_FIELDS },
      body: {
        email: contact.email.trim(),
        shipping_address: {
          first_name: contact.name.trim(),
          phone: contact.phone,
          country_code: SHOP_COUNTRY,
        },
        metadata: {
          [CART_METADATA.comment]: contact.comment.trim(),
          [CART_METADATA.channel]: contact.channel,
          [CART_METADATA.honeypot]: contact.website,
        },
      },
    })
  ).cart;

export async function choosePickup(cartId: string): Promise<Cart> {
  const { shipping_options } = await storeJson<{
    shipping_options: { id: string; type?: { code?: string } | null }[];
  }>('/store/shipping-options', { params: { cart_id: cartId } });
  const pickup = shipping_options.find(
    (option) => option.type?.code === PICKUP_OPTION_CODE,
  );
  if (!pickup) throw new NoPickupError(`No pickup option for cart ${cartId}`);
  return (
    await storeJson<{ cart: Cart }>(carts(cartId, '/shipping-methods'), {
      method: 'POST',
      params: { fields: CART_FIELDS },
      body: { option_id: pickup.id },
    })
  ).cart;
}

export async function preparePayment(cartId: string): Promise<number> {
  const { payment_collection } = await storeJson<{
    payment_collection: { id: string };
  }>('/store/payment-collections', {
    method: 'POST',
    body: { cart_id: cartId },
  });
  const { payment_collection: withSession } = await storeJson<{
    payment_collection: {
      payment_sessions?: { provider_id: string; amount: number }[];
    };
  }>(
    `/store/payment-collections/${encodeURIComponent(payment_collection.id)}/payment-sessions`,
    { method: 'POST', body: { provider_id: PAYMENT_PROVIDER } },
  );
  const session = withSession.payment_sessions?.find(
    (candidate) => candidate.provider_id === PAYMENT_PROVIDER,
  );
  if (!session) throw new Error('Medusa created no payment session');
  return session.amount;
}

export async function completeCart(cartId: string): Promise<PlacedOrder> {
  const result = await storeJson<{
    type: string;
    order?: PlacedOrder;
    error?: { message?: string };
  }>(carts(cartId, '/complete'), { method: 'POST', body: {} });
  if (result.type !== 'order' || !result.order) {
    throw new CompletionError(
      result.error?.message ?? 'Cart was not completed',
    );
  }
  return result.order;
}
