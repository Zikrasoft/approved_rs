import type { CheckoutRefusal } from '@podbor/catalog-contract';
import type { NotPlacedReason } from '@podbor/lead-crm/parts-order-copy';

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
  'price-changed' | 'cart-changed' | 'unavailable'
>;

const REFUSALS: Record<
  CheckoutRefusal,
  { notice: RefusalNotice; reason: NotPlacedReason }
> = {
  OFFER_PRICE_CHANGED: { notice: 'price-changed', reason: 'price' },
  CART_CHANGED: { notice: 'cart-changed', reason: 'cart' },
  OFFER_OUT_OF_STOCK: { notice: 'unavailable', reason: 'stock' },
  OFFER_MISSING: { notice: 'unavailable', reason: 'offer' },
  CONTACT_MISSING: { notice: 'unavailable', reason: 'contact' },
};

export const refusalNotice = (code: CheckoutRefusal): RefusalNotice =>
  REFUSALS[code].notice;

export const refusalReason = (code: CheckoutRefusal): NotPlacedReason =>
  REFUSALS[code].reason;
