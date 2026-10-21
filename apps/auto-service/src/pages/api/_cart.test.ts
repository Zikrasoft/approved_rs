import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { DELETE, GET, PATCH, POST } from './cart';

const backend = vi.fn();

beforeEach(() => {
  vi.stubEnv('MEDUSA_BACKEND_URL', 'http://shop.test');
  vi.stubEnv('MEDUSA_PUBLISHABLE_KEY', 'pk_test');
  vi.stubGlobal('fetch', backend);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  backend.mockReset();
});

const call = (
  route: typeof GET,
  { query = '', body }: { query?: string; body?: unknown } = {},
) =>
  route({
    url: new URL(`http://localhost/api/cart${query}`),
    request: new Request(`http://localhost/api/cart${query}`, {
      method: body === undefined ? 'GET' : 'POST',
      ...(body !== undefined && { body: JSON.stringify(body) }),
    }),
  } as unknown as APIContext) as Promise<Response>;

const outcome = async (response: Promise<Response>) => (await response).json();

describe('/api/cart', () => {
  it('answers a cart id that cannot be one with an empty cart, not the inquiry', async () => {
    expect(await outcome(call(GET, { query: '?id=../admin' }))).toEqual({
      kind: 'empty',
    });
    expect(backend).not.toHaveBeenCalled();
  });

  it('answers a malformed change with an empty cart, not the inquiry', async () => {
    expect(
      await outcome(call(DELETE, { body: { cart_id: 'cart/1' } })),
    ).toEqual({ kind: 'empty' });
  });

  it('answers more than the shop can hold as the supplier running out', async () => {
    expect(
      await outcome(
        call(PATCH, {
          body: { cart_id: 'cart_1', item_id: 'item_1', quantity: 1000 },
        }),
      ),
    ).toEqual({
      kind: 'refused',
      code: 'OFFER_OUT_OF_STOCK',
      cartId: 'cart_1',
    });
    expect(backend).not.toHaveBeenCalled();
  });

  it('adds as many of an offer as a kit needs', async () => {
    backend.mockResolvedValue(
      new Response(JSON.stringify({ code: 'OFFER_OUT_OF_STOCK' }), {
        status: 400,
      }),
    );

    await call(POST, {
      body: { cart_id: null, offer_id: 'offer_1', quantity: 4 },
    });

    const [url, init] = backend.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://shop.test/store/offer-carts');
    expect(JSON.parse(String(init.body))).toEqual({
      offer_id: 'offer_1',
      quantity: 4,
    });
  });
});
