import * as z from 'zod/mini';
import {
  offerCartSchema,
  type OfferCart,
  type OfferCartLine as CartLine,
} from '@podbor/catalog-contract/cart-wire';
import type { CartOutcome } from '@/utils/catalogueWire';
import {
  forgetStored,
  readStoredJson,
  writeStoredJson,
  type ValueStorage as CartStorage,
} from '@podbor/site-kit/stored-value';
import { CART_CHANGED_EVENT, CART_STORAGE_KEY } from './cartBadge';
import { addToPartsList, listedPartSchema, type ListedPart } from './partsList';

const storedCartSchema = z.object({
  id: z.string(),
  parts: z.array(listedPartSchema),
  count: z.optional(z.number()),
  prices: z.optional(z.record(z.string(), z.number())),
});

export type StoredCart = z.infer<typeof storedCartSchema>;

const announceCartChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CART_CHANGED_EVENT));
  }
};

export const readCart = (storage?: CartStorage): StoredCart | null =>
  readStoredJson(CART_STORAGE_KEY, storedCartSchema, null, storage);

function writeCart(stored: StoredCart, storage?: CartStorage): void {
  if (writeStoredJson(CART_STORAGE_KEY, stored, storage)) announceCartChange();
}

export const listedLine = ({
  part,
  quantity,
  addon,
}: CartLine): ListedPart => ({
  ...part,
  quantity,
  ...(addon && {
    addon: addon.label,
    ...(addon.translations && { addon_translations: addon.translations }),
    addon_price: addon.unit_price,
    with_addon: addon.item_id !== null,
  }),
});

export function rememberCart(cart: OfferCart, storage?: CartStorage): void {
  writeCart(
    {
      id: cart.id,
      parts: cart.items.map(listedLine),
      count: cart.items.reduce((sum, { quantity }) => sum + quantity, 0),
      prices: Object.fromEntries(
        cart.items.map(({ id, unit_price }) => [id, unit_price]),
      ),
    },
    storage,
  );
}

export function keepCartId(id: string | null, storage?: CartStorage): void {
  const stored = readCart(storage);
  if (id && stored?.id !== id) {
    writeCart({ id, parts: [], count: 0 }, storage);
  }
}

export function forgetCart(storage?: CartStorage): void {
  if (forgetStored(CART_STORAGE_KEY, storage)) announceCartChange();
}

export function forgetOrderedCart(
  orderedId: string | null,
  storage?: CartStorage,
): void {
  if (orderedId && readCart(storage)?.id === orderedId) forgetCart(storage);
}

export const orderedNumber = (
  notice: string,
  number: string | null,
): string | null =>
  notice === 'ordered' && number && /^\d+$/.test(number) ? number : null;

export const unavailableNames = (cart: OfferCart): string[] =>
  cart.items.filter(({ available }) => !available).map(({ part }) => part.name);

export function moveCartToInquiry(storage?: CartStorage): void {
  for (const part of readCart(storage)?.parts ?? []) {
    addToPartsList(part, storage);
  }
  forgetCart(storage);
}

export type CartState = 'cart' | 'gone' | 'refused' | 'unreachable';

export function settleCart(
  outcome: CartOutcome | null,
  storage?: CartStorage,
): CartState {
  switch (outcome?.kind) {
    case 'cart':
      return 'cart';
    case 'refused':
      return 'refused';
    case 'empty':
      forgetCart(storage);
      return 'gone';
    default:
      return 'unreachable';
  }
}

export type PriceChange = { name: string; before: number; after: number };

export const priceChanges = (
  seen: StoredCart,
  cart: OfferCart,
): PriceChange[] =>
  cart.items.flatMap(({ id, unit_price, part }) => {
    const before = seen.prices?.[id];
    return before !== undefined && before !== unit_price
      ? [{ name: part.name, before, after: unit_price }]
      : [];
  });

const RECEIPT_KEY = 'carlab_order_receipt';

export function rememberReceipt(
  cart: OfferCart,
  storage: CartStorage = sessionStorage,
): void {
  writeStoredJson(RECEIPT_KEY, cart, storage);
}

export function readReceipt(
  cartId: string | null,
  storage: CartStorage = sessionStorage,
): OfferCart | null {
  const receipt = readStoredJson(RECEIPT_KEY, offerCartSchema, null, storage);
  return receipt?.id === cartId ? receipt : null;
}
