import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { DELETE, GET, PATCH, POST, PUT } from './cart';

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
  {
    query = '',
    body,
    headers = {},
  }: { query?: string; body?: unknown; headers?: HeadersInit } = {},
) =>
  route({
    url: new URL(`http://localhost/api/cart${query}`),
    request: new Request(`http://localhost/api/cart${query}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
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

  it.each([
    ['DELETE', DELETE, { cart_id: 'cart/1' }],
    ['PATCH', PATCH, { cart_id: 'cart_1', item_id: 'item_1', quantity: 0 }],
    ['PATCH', PATCH, { cart_id: 'cart_1', item_id: 'item_1', quantity: 1.5 }],
    ['PATCH', PATCH, { cart_id: 'cart_1', item_id: 'item_1', quantity: '3' }],
    ['POST', POST, { cart_id: null, offer_id: 'offer_1', quantity: -1 }],
    ['PUT', PUT, { cart_id: 'cart_1', item_id: 'item_1' }],
  ])(
    'refuses a malformed %s as a bad request, never as a cart gone',
    async (_, route, body) => {
      const response = await call(route, { body });

      expect(response.status).toBe(400);
      expect(await response.json()).not.toEqual({ kind: 'empty' });
      expect(backend).not.toHaveBeenCalled();
    },
  );

  it('refuses a body that is not JSON as a bad request', async () => {
    const response = await PATCH({
      url: new URL('http://localhost/api/cart'),
      request: new Request('http://localhost/api/cart', {
        method: 'POST',
        body: 'nope',
      }),
    } as unknown as APIContext);

    expect(response.status).toBe(400);
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

  it('sends only which line wants the add-on, never a price', async () => {
    backend.mockResolvedValue(new Response('{}', { status: 404 }));

    await call(PUT, {
      body: {
        cart_id: 'cart_1',
        item_id: 'item_1',
        on: true,
        kind: 'service',
        unit_price: 1,
      },
    });

    const [url, init] = backend.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'http://shop.test/store/offer-carts/cart_1/items/item_1/addon',
    );
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
  });

  it('sends which line wants installation at CarLab, never a price', async () => {
    backend.mockResolvedValue(new Response('{}', { status: 404 }));

    await call(PUT, {
      body: {
        cart_id: 'cart_1',
        item_id: 'item_1',
        on: true,
        kind: 'installation',
        unit_price: 0,
      },
    });

    const [url, init] = backend.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'http://shop.test/store/offer-carts/cart_1/items/item_1/installation',
    );
    expect(init.body).toBe('{}');
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

  it('passes the preview flag of a closed-beta visitor on to the shop', async () => {
    backend.mockResolvedValue(new Response('{}', { status: 403 }));

    await call(POST, {
      body: { cart_id: null, offer_id: 'offer_1' },
      headers: { cookie: 'auto_service_shop_preview=1' },
    });
    await call(POST, { body: { cart_id: null, offer_id: 'offer_1' } });

    const sent = backend.mock.calls.map(
      ([, init]) => (init as RequestInit).headers,
    );
    expect(sent[0]).toMatchObject({ 'x-shop-preview': '1' });
    expect(sent[1]).not.toHaveProperty('x-shop-preview');
  });
});
