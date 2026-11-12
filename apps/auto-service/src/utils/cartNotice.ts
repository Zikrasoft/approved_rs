import type { CheckoutRefusal } from '@podbor/catalog-contract';

export const CART_NOTICE_PARAM = 'notice';
export const CART_LINES_FIELD = 'cart_lines';
export const ORDER_NUMBER_PARAM = 'order';
export const ORDERED_CART_PARAM = 'cart';

export type CartNotice =
  | 'ordered'
  | 'price-changed'
  | 'unavailable'
  | 'cart-changed'
  | 'unreachable'
  | 'expired'
  | 'invalid';

type RefusalNotice = Extract<
  CartNotice,
  'price-changed' | 'cart-changed' | 'unavailable' | 'unreachable'
>;

const REFUSAL_NOTICES: Record<CheckoutRefusal, RefusalNotice> = {
  OFFER_PRICE_CHANGED: 'price-changed',
  CART_CHANGED: 'cart-changed',
  OFFER_OUT_OF_STOCK: 'unavailable',
  OFFER_MISSING: 'unavailable',
  CONTACT_MISSING: 'unavailable',
  CHECKOUT_REFUSED: 'unreachable',
};

export const refusalNotice = (code: CheckoutRefusal): RefusalNotice =>
  REFUSAL_NOTICES[code];
