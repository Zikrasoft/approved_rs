import { applyCart, clearCart, currentCart } from './cart';
import { isOutOfStock } from './cartApi';
import {
  choosePickup,
  completeCart,
  preparePayment,
  retrieveCart,
  saveContact,
  type Contact,
  type PlacedOrder,
} from './checkoutApi';
import { StoreError } from './store';

export class NoCartError extends Error {}

export class AmountChangedError extends Error {}

export type CheckoutFailure =
  'stock' | 'tooMany' | 'network' | 'invalid' | 'changed' | 'generic';

export async function placeOrder(
  contact: Contact,
  shownTotal: number,
): Promise<PlacedOrder> {
  const id = currentCart()?.id;
  if (!id) throw new NoCartError('No cart to check out');
  const cart = await retrieveCart(id);
  if (cart.completed_at) {
    const order = await completeCart(id);
    clearCart();
    return order;
  }
  applyCart(await saveContact(id, contact));
  applyCart(await choosePickup(id));
  const amount = await preparePayment(id);
  if (amount !== shownTotal) {
    throw new AmountChangedError(
      `The payment session is ${amount}, the shopper saw ${shownTotal}`,
    );
  }
  const order = await completeCart(id);
  clearCart();
  return order;
}

export function checkoutFailure(error: unknown): CheckoutFailure {
  if (error instanceof AmountChangedError) return 'changed';
  if (isOutOfStock(error)) return 'stock';
  if (error instanceof StoreError && error.status === 429) return 'tooMany';
  if (error instanceof StoreError && error.status === 400) return 'invalid';
  if (error instanceof TypeError) return 'network';
  return 'generic';
}
