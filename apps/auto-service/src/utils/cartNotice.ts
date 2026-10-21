import type { CheckoutRefusal } from '@podbor/catalog-contract';

export const CART_NOTICE_PARAM = 'notice';

export type CartNotice =
  'ordered' | 'price-changed' | 'unavailable' | 'unreachable' | 'invalid';

export const refusalNotice = (code: CheckoutRefusal): CartNotice =>
  code === 'OFFER_PRICE_CHANGED' ? 'price-changed' : 'unavailable';
