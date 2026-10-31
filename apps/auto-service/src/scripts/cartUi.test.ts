// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/mini';
import { addToCart, getJson } from './cartUi';
import { readCart } from './cartStore';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('getJson', () => {
  it('asks the network every time, never the HTTP cache', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ kind: 'empty' }));
    vi.stubGlobal('fetch', fetch);

    await getJson(z.object({ kind: z.string() }), '/api/cart?id=cart_1', {
      method: 'GET',
    });

    expect(fetch).toHaveBeenCalledWith('/api/cart?id=cart_1', {
      cache: 'no-store',
      method: 'GET',
    });
  });
});

const serialLocks = () => {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    request: (_name: string, task: () => Promise<unknown>) => {
      const run = tail.then(task);
      tail = run.catch(() => undefined);
      return run;
    },
  };
};

const cartWith = (id: string, offers: string[]) => ({
  kind: 'cart',
  cart: {
    id,
    completed: false,
    currency: 'RSD',
    total: 0,
    items: offers.map((offer, index) => ({
      id: `item_${index}`,
      offer_id: offer,
      quantity: 1,
      unit_price: 0,
      available: true,
      in_stock: true,
      lead_time_days: 0,
      max_quantity: null,
      addon: null,
      installation: null,
      part: { slug: offer, brand: 'B', number: offer, name: offer },
    })),
  },
});

describe('addToCart', () => {
  it('lets the second of two tabs adding at once join the cart the first created', async () => {
    vi.stubGlobal('navigator', { locks: serialLocks() });
    const sent: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        sent.push(body.cart_id);
        await new Promise((resolve) => setTimeout(resolve, 5));
        return Response.json(
          cartWith(body.cart_id ?? 'cart_new', [
            ...(body.cart_id ? ['first'] : []),
            body.offer_id,
          ]),
        );
      }),
    );

    await Promise.all([
      addToCart({ offer_id: 'first' }),
      addToCart({ offer_id: 'second' }),
    ]);

    expect(sent).toEqual([null, 'cart_new']);
    expect(readCart()?.parts.map((part) => part.number)).toEqual([
      'first',
      'second',
    ]);
  });

  it('keeps the cart a refusal names', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          kind: 'refused',
          code: 'OFFER_OUT_OF_STOCK',
          cartId: 'cart_kept',
        }),
      ),
    );

    await addToCart({ offer_id: 'gone' });

    expect(readCart()?.id).toBe('cart_kept');
  });
});
