import { CART_METADATA } from '@podbor/shop-catalog/browser';
import { StoreError, storeJson } from './store';

export interface CartLine {
  id: string;
  variant_id: string | null;
  product_handle: string | null;
  product_title: string | null;
  quantity: number;
  unit_price: number;
  total: number | null;
}

export interface Cart {
  id: string;
  locale: string | null;
  total: number;
  items: CartLine[];
}

export const CART_FIELDS = '+items.total';

const params = { fields: CART_FIELDS };
const carts = (id: string, rest = '') =>
  `/store/carts/${encodeURIComponent(id)}${rest}`;

const send = async (path: string, method: string, body?: unknown) =>
  (await storeJson<{ cart: Cart }>(path, { method, params, body })).cart;

export const createCart = (input: {
  regionId: string;
  locale: string;
  preview: boolean;
}): Promise<Cart> =>
  send('/store/carts', 'POST', {
    region_id: input.regionId,
    locale: input.locale,
    ...(input.preview && { metadata: { [CART_METADATA.preview]: true } }),
  });

export const retrieveCart = (id: string): Promise<Cart> =>
  send(carts(id), 'GET');

export const updateCart = (
  id: string,
  body: Record<string, unknown>,
): Promise<Cart> => send(carts(id), 'POST', body);

export const addLine = (
  id: string,
  variantId: string,
  quantity: number,
): Promise<Cart> =>
  send(carts(id, '/line-items'), 'POST', { variant_id: variantId, quantity });

export const updateLine = (
  id: string,
  lineId: string,
  quantity: number,
): Promise<Cart> =>
  send(carts(id, `/line-items/${encodeURIComponent(lineId)}`), 'POST', {
    quantity,
  });

export const removeLine = async (id: string, lineId: string): Promise<Cart> =>
  (
    await storeJson<{ parent: Cart }>(
      carts(id, `/line-items/${encodeURIComponent(lineId)}`),
      { method: 'DELETE', params },
    )
  ).parent;

export const isCartGone = (error: unknown): boolean =>
  error instanceof StoreError && error.status === 404;

export const isOutOfStock = (error: unknown): boolean =>
  error instanceof StoreError && error.code === 'insufficient_inventory';
