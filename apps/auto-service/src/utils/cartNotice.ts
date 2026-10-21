import type { CheckoutRefusal } from '@podbor/catalog-contract';

export const CART_NOTICE_PARAM = 'notice';
export const ORDER_NUMBER_PARAM = 'order';

export type CartNotice =
  | 'ordered'
  | 'price-changed'
  | 'unavailable'
  | 'cart-changed'
  | 'unreachable'
  | 'invalid';

const REFUSAL_NOTICE: Partial<Record<CheckoutRefusal, CartNotice>> = {
  OFFER_PRICE_CHANGED: 'price-changed',
  CART_CHANGED: 'cart-changed',
};

export const refusalNotice = (code: CheckoutRefusal): CartNotice =>
  REFUSAL_NOTICE[code] ?? 'unavailable';
