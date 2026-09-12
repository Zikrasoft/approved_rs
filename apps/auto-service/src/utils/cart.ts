import { CURRENCY_SYMBOL } from './constants';

export interface CartLine {
  slug: string;
  title: string;
  price: number;
  quantity: number;
}

export const CART_STORAGE_KEY = 'autohub_cart';
export const CART_EVENT = 'autohub:cart';
export const MAX_LINE_QUANTITY = 20;

export function parseCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry): CartLine[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const line = entry as Record<string, unknown>;
    if (typeof line.slug !== 'string' || !line.slug) return [];
    if (typeof line.title !== 'string') return [];
    if (
      typeof line.price !== 'number' ||
      !Number.isFinite(line.price) ||
      line.price < 0
    )
      return [];
    const quantity = Math.trunc(Number(line.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) return [];
    return [
      {
        slug: line.slug,
        title: line.title,
        price: line.price,
        quantity: Math.min(quantity, MAX_LINE_QUANTITY),
      },
    ];
  });
}

export function addLine(cart: CartLine[], line: Omit<CartLine, 'quantity'>) {
  const existing = cart.find((l) => l.slug === line.slug);
  if (!existing) return [...cart, { ...line, quantity: 1 }];
  return cart.map((l) =>
    l.slug === line.slug
      ? { ...l, quantity: Math.min(l.quantity + 1, MAX_LINE_QUANTITY) }
      : l,
  );
}

export function setQuantity(
  cart: CartLine[],
  slug: string,
  quantity: number,
): CartLine[] {
  const next = Math.trunc(quantity);
  if (!Number.isFinite(next)) return cart;
  const clamped = Math.min(Math.max(next, 1), MAX_LINE_QUANTITY);
  return cart.map((l) => (l.slug === slug ? { ...l, quantity: clamped } : l));
}

export function removeLine(cart: CartLine[], slug: string): CartLine[] {
  return cart.filter((l) => l.slug !== slug);
}

export function cartCount(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.quantity, 0);
}

export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
}

export function describeCart(cart: CartLine[]): string {
  return cart
    .map(
      (l) =>
        `${l.title} × ${l.quantity} — ${l.price * l.quantity} ${CURRENCY_SYMBOL}`,
    )
    .join('\n');
}

export function readCart(): CartLine[] {
  try {
    return parseCart(localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeCart(cart: CartLine[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(CART_EVENT));
}

export function onCartChange(handler: () => void): void {
  window.addEventListener(CART_EVENT, handler);
  window.addEventListener('storage', (event) => {
    if (event.key === CART_STORAGE_KEY) handler();
  });
}
