import { MEDUSA_LOCALE } from '@podbor/shop-catalog/browser';
import type { Locale } from '@/i18n/config';
import * as api from './cartApi';
import type { Cart } from './cartApi';

export const CART_STORAGE_KEY = 'carlab_cart_id';
export const CART_EVENT = 'carlab:cart';

let current: Cart | null = null;

const channel =
  typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel('carlab-cart');

function announce(cart: Cart | null): void {
  current = cart;
  window.dispatchEvent(
    new CustomEvent<Cart | null>(CART_EVENT, { detail: cart }),
  );
}

function publish(cart: Cart): void {
  announce(cart);
  channel?.postMessage(cart);
}

function storedId(): string | null {
  try {
    return localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return null;
  }
}

function keepId(id: string | null): void {
  try {
    if (id) localStorage.setItem(CART_STORAGE_KEY, id);
    else localStorage.removeItem(CART_STORAGE_KEY);
  } catch (error) {
    console.warn('[cart] id not stored', error);
  }
}

function forget(): void {
  keepId(null);
  announce(null);
}

function forgetIfCurrent(id: string): void {
  if ((current?.id ?? storedId()) === id) forget();
}

channel?.addEventListener('message', (event: MessageEvent<Cart | null>) => {
  if (event.data === null) {
    forget();
    return;
  }
  if (event.data.id === (current?.id ?? storedId())) announce(event.data);
});

export const currentCart = (): Cart | null => current;

export function onCart(
  listener: (cart: Cart | null) => void,
  signal?: AbortSignal,
): void {
  window.addEventListener(
    CART_EVENT,
    (event) => listener((event as CustomEvent<Cart | null>).detail),
    { signal },
  );
}

export const applyCart = publish;

export function clearCart(): void {
  forget();
  channel?.postMessage(null);
}

export const cartCount = (cart: Cart | null): number =>
  cart?.items.reduce((sum, line) => sum + line.quantity, 0) ?? 0;

async function restore(locale: Locale): Promise<Cart | null> {
  const id = storedId();
  if (!id) return null;
  try {
    let cart = await api.retrieveCart(id);
    if (cart.completed_at) {
      forgetIfCurrent(id);
      return null;
    }
    const wanted = MEDUSA_LOCALE[locale];
    if (cart.locale !== wanted)
      cart = await api.updateCart(id, { locale: wanted });
    publish(cart);
    return cart;
  } catch (error) {
    if (!api.isCartGone(error)) throw error;
    forgetIfCurrent(id);
    return null;
  }
}

let loading: Promise<Cart | null> | null = null;

export function loadCart(locale: Locale): Promise<Cart | null> {
  loading ??= restore(locale).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

export async function refreshCart(): Promise<Cart | null> {
  const id = current?.id ?? storedId();
  if (!id) return null;
  try {
    const cart = await api.retrieveCart(id);
    if (cart.completed_at) {
      forgetIfCurrent(id);
      return null;
    }
    publish(cart);
    return cart;
  } catch (error) {
    if (!api.isCartGone(error)) throw error;
    forgetIfCurrent(id);
    return null;
  }
}

let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

interface NewCart {
  regionId: string;
  locale: string;
  preview: boolean;
}

let creating: Promise<string> | null = null;

function cartId(input: NewCart): Promise<string> {
  const known = current?.id ?? storedId();
  if (known) return Promise.resolve(known);
  creating ??= api
    .createCart(input)
    .then((cart) => {
      keepId(cart.id);
      publish(cart);
      return cart.id;
    })
    .finally(() => {
      creating = null;
    });
  return creating;
}

export function addToCart(input: {
  regionId: string;
  locale: Locale;
  preview: boolean;
  variantId: string;
  quantity?: number;
}): Promise<Cart> {
  const create = {
    regionId: input.regionId,
    locale: MEDUSA_LOCALE[input.locale],
    preview: input.preview,
  };
  const quantity = input.quantity ?? 1;
  const idPromise = cartId(create);
  return serialize(async () => {
    const id = await idPromise;
    try {
      const cart = await api.addLine(id, input.variantId, quantity);
      publish(cart);
      return cart;
    } catch (error) {
      if (!api.isCartGone(error)) throw error;
      forgetIfCurrent(id);
      const cart = await api.addLine(
        await cartId(create),
        input.variantId,
        quantity,
      );
      publish(cart);
      return cart;
    }
  });
}

function mutate(operation: (id: string) => Promise<Cart>): Promise<void> {
  const id = current?.id ?? storedId();
  if (!id) return Promise.resolve();
  return serialize(async () => {
    try {
      publish(await operation(id));
    } catch (error) {
      if (api.isCartGone(error)) forgetIfCurrent(id);
      throw error;
    }
  });
}

export const setQuantity = (lineId: string, quantity: number): Promise<void> =>
  mutate((id) =>
    quantity < 1
      ? api.removeLine(id, lineId)
      : api.updateLine(id, lineId, quantity),
  );

export const removeFromCart = (lineId: string): Promise<void> =>
  mutate((id) => api.removeLine(id, lineId));
