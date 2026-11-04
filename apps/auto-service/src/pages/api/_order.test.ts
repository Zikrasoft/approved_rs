import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import type { NotifyLead } from '@podbor/lead-crm';
import { PARTS_ORDER_COPY } from '@podbor/lead-crm/parts-order-copy';
import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';

const notifyLead = vi.hoisted(() =>
  vi.fn<NotifyLead>(async () => ({ stored: true, delivered: true })),
);
const pending = vi.hoisted(() => [] as Promise<unknown>[]);
const failedCheckoutCapped = vi.hoisted(() => vi.fn(async () => false));

vi.mock('@/lib/crm', () => ({
  BRAND: 'CarLab',
  notifyLead,
  leadStore: { failedCheckoutCapped },
}));
vi.mock('@vercel/functions', () => ({
  waitUntil: (promise: Promise<unknown>) => pending.push(promise),
}));

import { POST } from './order';

const backend = vi.fn();
const PREVIEW_TOKEN = 'preview-token-0123456789abcdef0123';

beforeEach(() => {
  vi.stubEnv('MEDUSA_BACKEND_URL', 'http://shop.test');
  vi.stubEnv('MEDUSA_PUBLISHABLE_KEY', 'pk_test');
  vi.stubEnv('SHOP_PREVIEW_TOKEN', PREVIEW_TOKEN);
  vi.stubGlobal('fetch', backend);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  backend.mockReset();
  notifyLead.mockClear();
  failedCheckoutCapped.mockClear();
  pending.length = 0;
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

  it.each([
    ['no fingerprint', { cart_fingerprint: '' }],
    ['a garbled cart id', { cart_id: 'x/../y' }],
    ['no cart id', { cart_id: '' }],
  ])(
    'keeps the contact of a checkout with %s as a Lead, without asking the shop',
    async (_, fields) => {
      const response = await checkout(fields);

      expect(location(response)).toBe('/ru/parts/cart/?notice=expired');
      expect(backend).not.toHaveBeenCalled();
      expect(notifyLead.mock.calls[0]?.[0].comment).toContain(
        PARTS_ORDER_COPY.notPlaced('корзина устарела'),
      );
    },
  );

  it('keeps no Lead once the contact hit the hourly cap of failed checkouts', async () => {
    failedCheckoutCapped.mockResolvedValueOnce(true);
    answer(404, { type: 'not_found' });

    expect(location(await checkout())).toBe('/ru/parts/cart/?notice=expired');
    expect(failedCheckoutCapped).toHaveBeenCalledWith(
      'CarLab',
      '+381601234567',
    );
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('keeps the Lead when the cap cannot be read', async () => {
    failedCheckoutCapped.mockRejectedValueOnce(new Error('blob down'));
    answer(404, { type: 'not_found' });

    await checkout();

    expect(notifyLead).toHaveBeenCalledOnce();
  });

  it('keeps no Lead for a checkout without a contact or consent', async () => {
    expect(location(await checkout({ contact: '12' }))).toBe(
      '/ru/parts/cart/?notice=invalid',
    );
    expect(location(await checkout({ consent: '' }))).toBe(
      '/ru/parts/cart/?notice=invalid',
    );
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('refuses an oversized body before reading it', async () => {
    const response = await checkout({}, { 'content-length': '70000' });

    expect(response.status).toBe(413);
    expect(backend).not.toHaveBeenCalled();
    expect(notifyLead).not.toHaveBeenCalled();
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
      { cookie: `auto_service_shop_preview=${PREVIEW_TOKEN}` },
    );

    expect(location(response)).toContain('notice=ordered');
    const [, init] = backend.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ 'x-shop-preview': PREVIEW_TOKEN });
  });

  describe('a checkout that does not become an order', () => {
    const VISITOR = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const failedCheckout = () =>
      checkout({
        name: 'Ana',
        comment: 'Posle 17h',
        cart_lines: 'VARTA 580901080, Akumulator × 2',
        visitor_id: VISITOR,
      });
    const keptLead = () => notifyLead.mock.calls[0]?.[0];

    it('keeps the contact and the cart as a Lead when the shop is down', async () => {
      backend.mockRejectedValue(new TypeError('fetch failed'));

      const response = await failedCheckout();

      expect(location(response)).toBe('/ru/parts/cart/?notice=unreachable');
      expect(pending).toHaveLength(1);
      expect(keptLead()).toMatchObject({
        name: 'Ana',
        contact: '+381601234567',
        contactChannel: 'whatsapp',
        service: 'parts-order',
        services: ['parts-order'],
        visitorId: VISITOR,
        orderId: null,
        locale: 'ru',
        comment: [
          PARTS_ORDER_COPY.notPlaced('магазин не ответил'),
          'VARTA 580901080, Akumulator × 2',
          'Posle 17h',
        ].join('\n'),
      });
    });

    it.each([
      [400, { code: 'OFFER_PRICE_CHANGED' }, 'цена изменилась'],
      [400, { code: 'OFFER_OUT_OF_STOCK' }, 'позиции нет в нужном количестве'],
      [400, { code: 'OFFER_MISSING' }, 'позицию больше не продают'],
      [404, { type: 'not_found' }, 'корзина устарела'],
    ])(
      'keeps the contact when the shop answers %i %o',
      async (status, body, reason) => {
        answer(status, body);

        await failedCheckout();

        expect(keptLead()?.comment).toContain(
          PARTS_ORDER_COPY.notPlaced(reason),
        );
      },
    );

    it('fits an over-long cart into the Lead and counts what it left out', async () => {
      backend.mockRejectedValue(new TypeError('fetch failed'));
      const line = `VARTA 580901080, ${'Akumulator '.repeat(10)}× 1`;

      await checkout({
        cart_lines: Array.from({ length: 40 }, () => line).join('\n'),
        comment: 'Posle 17h',
      });

      const comment = keptLead()?.comment ?? '';
      expect(comment.length).toBeLessThanOrEqual(MAX_COMMENT_LENGTH);
      expect(comment).toMatch(/\nНе поместилось позиций: \d+\nPosle 17h$/);
    });

    it('stores the cart lines with plain line breaks', async () => {
      backend.mockRejectedValue(new TypeError('fetch failed'));

      await checkout({ cart_lines: 'VARTA × 1\r\nATE × 2\rИтого: 1 RSD' });

      expect(keptLead()?.comment).toContain('VARTA × 1\nATE × 2\nИтого: 1 RSD');
      expect(keptLead()?.comment).not.toContain('\r');
    });

    it('keeps no Lead for an order placed', async () => {
      answer(200, { order: { id: 'order_1', display_id: 42 } });

      await failedCheckout();

      expect(notifyLead).not.toHaveBeenCalled();
    });
  });
});
