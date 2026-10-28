import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { POST } from './order';

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

const answer = (status: number, body: unknown) =>
  backend.mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );

const submit = (body: BodyInit, headers: HeadersInit = {}) =>
  POST({
    request: new Request('http://localhost/api/order', {
      method: 'POST',
      body,
      headers,
    }),
    redirect: (path: string, status?: number) =>
      new Response(null, { status, headers: { location: path } }),
  } as unknown as APIContext);

const checkout = (
  fields: Record<string, string> = {},
  headers: HeadersInit = {},
) => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    locale: 'ru',
    cart_id: 'cart_1',
    cart_fingerprint: 'item_1:1:1850',
    contact: '+381601234567',
    contact_channel: 'whatsapp',
    consent: '1',
    ...fields,
  })) {
    form.set(key, value);
  }
  return submit(form, headers);
};

const location = (response: Response) => response.headers.get('location');

describe('POST /api/order', () => {
  it('shows the order number on the cart page once the order is placed', async () => {
    answer(200, { order: { id: 'order_1', display_id: 42 } });

    const response = await checkout();

    expect(response.status).toBe(303);
    expect(location(response)).toBe(
      '/ru/parts/cart/?notice=ordered&order=42&cart=cart_1',
    );
  });

  it('checks out the cart the visitor saw and keeps their attribution', async () => {
    answer(200, { order: { id: 'order_1', display_id: 42 } });

    await checkout({
      source_url: 'https://carlab.rs/ru/parts/cart/',
      visitor_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
    });

    const [, init] = backend.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      cart_fingerprint: 'item_1:1:1850',
      source_url: 'https://carlab.rs/ru/parts/cart/',
      visitor_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
    });
  });

  it('sends the visitor back to the cart when it changed in another tab', async () => {
    answer(400, { code: 'CART_CHANGED' });

    expect(location(await checkout())).toBe(
      '/ru/parts/cart/?notice=cart-changed',
    );
  });

  it('tells the visitor the cart expired when the shop no longer knows it', async () => {
    answer(404, { type: 'not_found' });

    expect(location(await checkout())).toBe('/ru/parts/cart/?notice=expired');
  });

  it('refuses a checkout that does not say which cart the visitor saw', async () => {
    const response = await checkout({ cart_fingerprint: '' });

    expect(location(response)).toBe('/ru/parts/cart/?notice=invalid');
    expect(backend).not.toHaveBeenCalled();
  });

  it('answers a body that is not a form with a redirect, not a crash', async () => {
    const response = await submit('{"cart_id":"cart_1"}', {
      'content-type': 'application/json',
    });

    expect(response.status).toBe(303);
    expect(location(response)).toBe('/sr/parts/cart/?notice=invalid');
    expect(backend).not.toHaveBeenCalled();
  });

  it('passes the preview flag of a closed-beta visitor on to the shop', async () => {
    answer(200, { order: { id: 'order_1', display_id: 42 } });

    const response = await checkout(
      {},
      { cookie: 'auto_service_shop_preview=1' },
    );

    expect(location(response)).toContain('notice=ordered');
    const [, init] = backend.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ 'x-shop-preview': '1' });
  });
});
