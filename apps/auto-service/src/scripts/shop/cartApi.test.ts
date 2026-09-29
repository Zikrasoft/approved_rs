import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLine,
  createCart,
  isCartGone,
  isOutOfStock,
  removeLine,
  updateCart,
  updateLine,
} from './cartApi';

const fetchMock = vi.fn();
const CART = { id: 'cart_1', locale: 'sr-RS', total: 0, items: [] };

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return {
    url: new URL(String(url)),
    method: init.method,
    body: init.body ? JSON.parse(init.body) : undefined,
  };
};

beforeEach(() => {
  vi.stubEnv('PUBLIC_MEDUSA_BACKEND_URL', 'http://store.test');
  vi.stubEnv('PUBLIC_MEDUSA_PUBLISHABLE_KEY', 'pk_test');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock
    .mockReset()
    .mockImplementation(async () => Response.json({ cart: CART }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('cart API', () => {
  it('opens a cart in the region and the shopper language', async () => {
    await createCart({ regionId: 'reg_1', locale: 'sr-RS', preview: false });

    expect(lastCall()).toMatchObject({
      method: 'POST',
      body: { region_id: 'reg_1', locale: 'sr-RS' },
    });
    expect(lastCall().body).not.toHaveProperty('metadata');
    expect(lastCall().url.searchParams.get('fields')).toBe('+items.total');
  });

  it('marks a cart opened in preview so its order can be cleaned up', async () => {
    await createCart({ regionId: 'reg_1', locale: 'en-US', preview: true });

    expect(lastCall().body.metadata).toEqual({ preview: true });
  });

  it('adds, changes and removes lines on the right routes', async () => {
    await addLine('cart_1', 'var_1', 2);
    expect(lastCall()).toMatchObject({
      method: 'POST',
      body: { variant_id: 'var_1', quantity: 2 },
    });
    expect(lastCall().url.pathname).toBe('/store/carts/cart_1/line-items');

    await updateLine('cart_1', 'line_1', 3);
    expect(lastCall().url.pathname).toBe(
      '/store/carts/cart_1/line-items/line_1',
    );
    expect(lastCall().body).toEqual({ quantity: 3 });

    fetchMock.mockResolvedValueOnce(
      Response.json({ id: 'line_1', deleted: true, parent: CART }),
    );
    expect(await removeLine('cart_1', 'line_1')).toEqual(CART);
    expect(lastCall().method).toBe('DELETE');
  });

  it('switches the cart language with a plain cart update', async () => {
    await updateCart('cart_1', { locale: 'en-US' });

    expect(lastCall()).toMatchObject({
      method: 'POST',
      body: { locale: 'en-US' },
    });
  });

  it('tells a forgotten cart from a sold-out variant', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 404 }));
    const gone = await addLine('cart_x', 'var_1', 1).catch((e) => e);
    fetchMock.mockResolvedValueOnce(
      Response.json({ code: 'insufficient_inventory' }, { status: 400 }),
    );
    const sold = await addLine('cart_1', 'var_1', 1).catch((e) => e);

    expect([isCartGone(gone), isOutOfStock(gone)]).toEqual([true, false]);
    expect([isCartGone(sold), isOutOfStock(sold)]).toEqual([false, true]);
    expect(isOutOfStock(new Error('x'))).toBe(false);
  });
});
