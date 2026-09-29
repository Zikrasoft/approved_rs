// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';

const listeners: ((cart: unknown) => void)[] = [];
const cartModule = vi.hoisted(() => ({
  loadCart: vi.fn().mockResolvedValue(null),
  currentCart: vi.fn().mockReturnValue(null),
  onCart: vi.fn(),
  cartCount: (cart: { items: { quantity: number }[] } | null) =>
    cart?.items.reduce((sum, line) => sum + line.quantity, 0) ?? 0,
}));
vi.mock('./cart', () => cartModule);

const { defineCartCount } = await import('./cartCount');

beforeAll(() => {
  cartModule.onCart.mockImplementation((listener) => listeners.push(listener));
  defineCartCount();
});

describe('<cart-count>', () => {
  it('loads the cart in the page language and shows the pieces', () => {
    document.body.innerHTML = `<a href="/en/cart/"><cart-count data-locale="en" data-label="items in cart" hidden></cart-count></a>`;
    const badge = document.querySelector<HTMLElement>('cart-count')!;

    expect(cartModule.loadCart).toHaveBeenCalledWith('en');
    listeners.at(-1)!({ items: [{ quantity: 2 }, { quantity: 1 }] });

    expect([badge.hidden, badge.textContent]).toEqual([false, '3']);
    expect(badge.closest('a')!.getAttribute('aria-label')).toBe(
      'items in cart: 3',
    );

    listeners.at(-1)!(null);
    expect(badge.hidden).toBe(true);
  });

  it('stays quiet when the cart cannot be loaded', async () => {
    cartModule.loadCart.mockRejectedValueOnce(new TypeError('offline'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    document.body.innerHTML = `<a><cart-count data-locale="sr"></cart-count></a>`;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
