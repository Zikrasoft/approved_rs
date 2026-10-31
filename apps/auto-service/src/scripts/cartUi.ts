import type { ZodMiniType } from 'zod/mini';
import { cartOutcomeSchema } from '@/utils/catalogueWire';
import { keepCartId, readCart, rememberCart } from './cartStore';

export const getJson = async <T>(
  schema: ZodMiniType<T>,
  url: string,
  init?: RequestInit,
): Promise<T | null> => {
  try {
    const response = await fetch(url, { cache: 'no-store', ...init });
    if (!response.ok) return null;
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const sendJson = (method: string, body: unknown) =>
  getJson(cartOutcomeSchema, '/api/cart', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const CART_LOCK = 'carlab-offer-cart';

const withCartLock = async <T>(task: () => Promise<T>): Promise<T> =>
  navigator.locks ? await navigator.locks.request(CART_LOCK, task) : task();

export const addToCart = (line: { offer_id?: string; quantity?: number }) =>
  withCartLock(async () => {
    const outcome = await sendJson('POST', {
      cart_id: readCart()?.id ?? null,
      ...line,
    });
    if (outcome?.kind === 'cart') rememberCart(outcome.cart);
    if (outcome?.kind === 'refused') keepCartId(outcome.cartId);
    return outcome;
  });

export const fill = (
  root: ParentNode,
  selector: string,
  text: string | null,
) => {
  const node = root.querySelector<HTMLElement>(selector);
  if (!node) return;
  node.textContent = text ?? '';
  node.hidden = text === null;
};

export const busy = (button: HTMLElement, on: boolean) => {
  if (on) {
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-disabled', 'true');
  } else {
    button.removeAttribute('aria-busy');
    button.removeAttribute('aria-disabled');
  }
};

export const isBusy = (button: HTMLElement) =>
  button.getAttribute('aria-busy') === 'true';

export const showOnly = (
  root: ParentNode,
  attribute: string,
  value: string,
) => {
  for (const block of root.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
    block.hidden = block.getAttribute(attribute) !== value;
  }
};
