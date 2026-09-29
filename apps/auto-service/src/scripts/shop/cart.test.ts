// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  createCart: vi.fn(),
  retrieveCart: vi.fn(),
  updateCart: vi.fn(),
  addLine: vi.fn(),
  updateLine: vi.fn(),
  removeLine: vi.fn(),
  isCartGone: vi.fn(),
  isOutOfStock: vi.fn(),
}));

vi.mock('./cartApi', () => api);

class Gone extends Error {}

const cart = (
  id: string,
  locale = 'sr-RS',
  items: object[] = [],
  completedAt: string | null = null,
) => ({
  id,
  locale,
  total: 0,
  items,
  completed_at: completedAt,
});

const load = () => import('./cart');

const ADD = {
  regionId: 'reg_1',
  locale: 'sr' as const,
  preview: true,
  variantId: 'var_1',
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal('BroadcastChannel', undefined);
  api.isCartGone.mockImplementation((e: unknown) => e instanceof Gone);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadCart', () => {
  it('does nothing without a stored cart', async () => {
    const { loadCart, currentCart } = await load();

    expect(await loadCart('sr')).toBeNull();
    expect(api.retrieveCart).not.toHaveBeenCalled();
    expect(currentCart()).toBeNull();
  });

  it('restores the stored cart and tells the page', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    api.retrieveCart.mockResolvedValue(cart('cart_1'));
    const { loadCart, currentCart, onCart } = await load();
    const heard = vi.fn();
    onCart(heard);

    await loadCart('sr');

    expect(currentCart()).toEqual(cart('cart_1'));
    expect(heard).toHaveBeenCalledWith(cart('cart_1'));
  });

  it('moves a cart opened in Serbian to English when the shopper switches language', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    api.retrieveCart.mockResolvedValue(cart('cart_1', 'sr-RS'));
    api.updateCart.mockResolvedValue(cart('cart_1', 'en-US'));
    const { loadCart, currentCart } = await load();

    await loadCart('en');

    expect(api.updateCart).toHaveBeenCalledTimes(1);
    expect(api.updateCart).toHaveBeenCalledWith('cart_1', { locale: 'en-US' });
    expect(currentCart()?.locale).toBe('en-US');
  });

  it('leaves a cart already in the page language alone', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    api.retrieveCart.mockResolvedValue(cart('cart_1', 'ru-RU'));
    const { loadCart } = await load();

    await loadCart('ru');

    expect(api.updateCart).not.toHaveBeenCalled();
  });

  it('asks once when the header and the cart page both load', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    api.retrieveCart.mockResolvedValue(cart('cart_1'));
    const { loadCart } = await load();

    await Promise.all([loadCart('sr'), loadCart('sr')]);

    expect(api.retrieveCart).toHaveBeenCalledTimes(1);
  });

  it('asks again after a failed load instead of replaying the failure', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    api.retrieveCart
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValue(cart('cart_1'));
    const { loadCart, currentCart } = await load();

    await expect(loadCart('sr')).rejects.toThrow();
    await loadCart('sr');

    expect(currentCart()).toEqual(cart('cart_1'));
  });

  it('forgets a cart the server no longer knows', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_gone');
    api.retrieveCart.mockRejectedValue(new Gone());
    const { loadCart } = await load();

    expect(await loadCart('sr')).toBeNull();
    expect(localStorage.getItem('carlab_cart_id')).toBeNull();
  });

  it('forgets a completed cart and starts a new one on the next add', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    api.retrieveCart.mockResolvedValue(
      cart('cart_1', 'sr-RS', [], '2024-01-01T00:00:00Z'),
    );
    api.createCart.mockResolvedValue(cart('cart_new'));
    api.addLine.mockResolvedValue(cart('cart_new', 'sr-RS', [{ quantity: 1 }]));
    const { loadCart, addToCart, currentCart } = await load();

    expect(await loadCart('sr')).toBeNull();
    expect(api.updateCart).not.toHaveBeenCalled();
    expect(localStorage.getItem('carlab_cart_id')).toBeNull();

    await addToCart(ADD);

    expect(api.createCart).toHaveBeenCalledTimes(1);
    expect(currentCart()?.id).toBe('cart_new');
  });
});

describe('refreshCart', () => {
  it('forgets a completed cart instead of reviving it', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    api.retrieveCart.mockResolvedValue(
      cart('cart_1', 'sr-RS', [], '2024-01-01T00:00:00Z'),
    );
    const { refreshCart, currentCart } = await load();

    expect(await refreshCart()).toBeNull();
    expect(currentCart()).toBeNull();
    expect(localStorage.getItem('carlab_cart_id')).toBeNull();
  });
});

describe('addToCart', () => {
  it('opens one cart in the shopper language, keeps its id and adds the line', async () => {
    api.createCart.mockResolvedValue(cart('cart_new'));
    api.addLine.mockResolvedValue(cart('cart_new', 'sr-RS', [{ quantity: 1 }]));
    const { addToCart, currentCart } = await load();

    await Promise.all([addToCart(ADD), addToCart(ADD)]);

    expect(api.createCart).toHaveBeenCalledTimes(1);
    expect(api.createCart).toHaveBeenCalledWith({
      regionId: 'reg_1',
      locale: 'sr-RS',
      preview: true,
    });
    expect(localStorage.getItem('carlab_cart_id')).toBe('cart_new');
    expect(api.addLine).toHaveBeenCalledWith('cart_new', 'var_1', 1);
    expect(currentCart()?.items).toHaveLength(1);
  });

  it('reuses the stored cart', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    api.addLine.mockResolvedValue(cart('cart_1'));
    const { addToCart } = await load();

    await addToCart({ ...ADD, quantity: 2 });

    expect(api.createCart).not.toHaveBeenCalled();
    expect(api.addLine).toHaveBeenCalledWith('cart_1', 'var_1', 2);
  });

  it('opens a fresh cart when the stored one is gone', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_old');
    api.addLine
      .mockRejectedValueOnce(new Gone())
      .mockResolvedValue(cart('cart_new'));
    api.createCart.mockResolvedValue(cart('cart_new'));
    const { addToCart } = await load();

    await addToCart(ADD);

    expect(api.addLine).toHaveBeenLastCalledWith('cart_new', 'var_1', 1);
    expect(localStorage.getItem('carlab_cart_id')).toBe('cart_new');
  });

  it('passes a sold-out refusal through untouched', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    const soldOut = new Error('insufficient_inventory');
    api.addLine.mockRejectedValue(soldOut);
    const { addToCart } = await load();

    await expect(addToCart(ADD)).rejects.toBe(soldOut);
    expect(localStorage.getItem('carlab_cart_id')).toBe('cart_1');
  });

  it('does not drop a cart another call already recreated', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    let rejectAdd: (error: unknown) => void = () => {};
    api.addLine.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectAdd = reject;
      }),
    );
    const { addToCart, applyCart, currentCart } = await load();

    const pending = addToCart(ADD).catch((error: unknown) => error);
    applyCart(cart('cart_new', 'sr-RS', [{ quantity: 9 }]) as never);
    rejectAdd(new Gone());
    await pending;

    expect(currentCart()?.id).toBe('cart_new');
  });
});

describe('changing lines', () => {
  it('removes a line set below one and updates the others', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    api.removeLine.mockResolvedValue(cart('cart_1'));
    api.updateLine.mockResolvedValue(cart('cart_1'));
    const { setQuantity } = await load();

    await setQuantity('line_1', 0);
    await setQuantity('line_2', 3);

    expect(api.removeLine).toHaveBeenCalledWith('cart_1', 'line_1');
    expect(api.updateLine).toHaveBeenCalledWith('cart_1', 'line_2', 3);
  });

  it('forgets a cart that vanished mid-edit and still reports the failure', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    api.removeLine.mockRejectedValue(new Gone());
    const { removeFromCart, currentCart } = await load();

    await expect(removeFromCart('line_1')).rejects.toBeInstanceOf(Gone);
    expect(localStorage.getItem('carlab_cart_id')).toBeNull();
    expect(currentCart()).toBeNull();
  });

  it('does not drop a cart another call already recreated', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    let rejectRemove: (error: unknown) => void = () => {};
    api.removeLine.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRemove = reject;
      }),
    );
    const { removeFromCart, applyCart, currentCart } = await load();

    const pending = removeFromCart('line_1').catch((error: unknown) => error);
    applyCart(cart('cart_new', 'sr-RS', [{ quantity: 9 }]) as never);
    rejectRemove(new Gone());

    expect(await pending).toBeInstanceOf(Gone);
    expect(currentCart()?.id).toBe('cart_new');
  });

  it('serialises quantity changes so an older response cannot publish over a newer one', async () => {
    localStorage.setItem('carlab_cart_id', 'cart_1');
    let resolveFirst!: (value: ReturnType<typeof cart>) => void;
    api.updateLine.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    api.updateLine.mockResolvedValueOnce(
      cart('cart_1', 'sr-RS', [{ quantity: 5 }]),
    );
    const { setQuantity, currentCart } = await load();

    const first = setQuantity('line_1', 2);
    const second = setQuantity('line_1', 5);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.updateLine).toHaveBeenCalledTimes(1);

    resolveFirst(cart('cart_1', 'sr-RS', [{ quantity: 2 }]));
    await first;
    await second;

    expect(api.updateLine).toHaveBeenCalledTimes(2);
    expect(currentCart()?.items).toEqual([{ quantity: 5 }]);
  });

  it('counts pieces, not lines', async () => {
    const { cartCount } = await load();

    expect(
      cartCount(
        cart('c', 'sr-RS', [{ quantity: 2 }, { quantity: 1 }]) as never,
      ),
    ).toBe(3);
    expect(cartCount(null)).toBe(0);
  });
});

describe('other tabs', () => {
  it('shares every change and the checkout with the other tabs', async () => {
    const posted: unknown[] = [];
    const listeners: ((event: MessageEvent) => void)[] = [];
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        postMessage(message: unknown) {
          posted.push(message);
        }
        addEventListener(
          _type: string,
          listener: (event: MessageEvent) => void,
        ) {
          listeners.push(listener);
        }
      },
    );
    localStorage.setItem('carlab_cart_id', 'cart_1');
    api.retrieveCart.mockResolvedValue(cart('cart_1'));
    const { loadCart, clearCart, currentCart } = await load();

    await loadCart('sr');
    listeners[0]({
      data: cart('cart_1', 'sr-RS', [{ quantity: 4 }]),
    } as MessageEvent);
    expect(currentCart()?.items).toHaveLength(1);

    listeners[0]({ data: cart('cart_other') } as MessageEvent);
    expect(currentCart()?.id).toBe('cart_1');

    clearCart();
    expect(posted.at(-1)).toBeNull();
    expect(localStorage.getItem('carlab_cart_id')).toBeNull();
  });
});

describe('storage failures', () => {
  it('treats an unreadable cart id as absent', async () => {
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });

    const { loadCart, currentCart } = await load();

    expect(await loadCart('sr')).toBeNull();
    expect(api.retrieveCart).not.toHaveBeenCalled();
    expect(currentCart()).toBeNull();

    spy.mockRestore();
  });

  it('swallows a write failure when a cart id cannot be stored', async () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.createCart.mockResolvedValue(cart('cart_new'));
    api.addLine.mockResolvedValue(cart('cart_new', 'sr-RS', [{ quantity: 1 }]));
    const { addToCart, currentCart } = await load();

    await addToCart(ADD);

    expect(currentCart()?.id).toBe('cart_new');
    expect(warnSpy).toHaveBeenCalled();

    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
