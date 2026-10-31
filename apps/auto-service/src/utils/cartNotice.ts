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

const REFUSAL_NOTICE: Partial<Record<CheckoutRefusal, CartNotice>> = {
  OFFER_PRICE_CHANGED: 'price-changed',
  CART_CHANGED: 'cart-changed',
};

export const refusalNotice = (code: CheckoutRefusal): CartNotice =>
  REFUSAL_NOTICE[code] ?? 'unavailable';
