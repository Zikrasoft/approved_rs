import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PARTS_ORDER_SERVICE } from '@podbor/brands';
import { createShopOrdersRoute } from './shopOrders.ts';
import type { ShopOrderEvent } from '../shopOrdersWire.ts';

const AD_SOURCE = {
  source: 'google',
  medium: 'cpc',
  campaign: 'parts',
  at: '2026-10-30T10:00:00.000Z',
};
const META_IDS = { fbp: 'fb.1.1700000000000.123' };

const notifyLead = vi.fn();
const cancelOrder = vi.fn();

const POST = createShopOrdersRoute({
  secret: 'shop-secret',
  notifyLead,
  cancelOrder,
  isLocale: (value) => ['ru', 'sr', 'en'].includes(value),
  defaultLocale: 'sr',
});

const call = (body: unknown, authorization = 'Bearer shop-secret') =>
  POST({
    request: new Request('https://carlab.rs/api/shop-orders', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  });

const placed = (contact: Record<string, string> = {}): ShopOrderEvent => ({
  event: 'placed',
  order_id: 'order_1',
  contact: {
    contact: '+381 60 1234567',
    contact_channel: 'whatsapp',
    ...contact,
  },
  summary: 'Заказ #7\nИтого: 1 850 RSD',
});

beforeEach(() => {
  notifyLead.mockReset().mockResolvedValue({ stored: true, delivered: true });
  cancelOrder.mockReset().mockResolvedValue('lost');
});

describe('createShopOrdersRoute', () => {
  it.each(['', 'Bearer wrong', 'shop-secret'])(
    'refuses a post without the shop secret (%j)',
    async (authorization) => {
      expect((await call(placed(), authorization)).status).toBe(401);
      expect(notifyLead).not.toHaveBeenCalled();
    },
  );

  it('refuses an oversized body before reading it', async () => {
    const response = await POST({
      request: new Request('https://carlab.rs/api/shop-orders', {
        method: 'POST',
        headers: {
          authorization: 'Bearer shop-secret',
          'content-length': '70000',
        },
        body: JSON.stringify(placed()),
      }),
    });
    expect(response.status).toBe(413);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it.each(['not json', { event: 'placed', order_id: 'order_1' }])(
    'refuses a body that is not a shop order event (%j)',
    async (body) => {
      expect((await call(body)).status).toBe(400);
    },
  );

  it('stores a placed Order as a parts-order Lead and answers 201', async () => {
    const response = await call(
      placed({
        name: 'Ana',
        vin: 'wba8e9g50gnu12345',
        locale: 'ru',
        source_url: 'https://carlab.rs/sr/parts/cart/',
        visitor_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
        ad_source: JSON.stringify(AD_SOURCE),
        meta_ids: JSON.stringify(META_IDS),
      }),
    );

    expect(response.status).toBe(201);
    expect(notifyLead).toHaveBeenCalledWith(
      {
        name: 'Ana',
        contact: '+381601234567',
        contactChannel: 'whatsapp',
        service: PARTS_ORDER_SERVICE,
        services: [PARTS_ORDER_SERVICE],
        comment: 'VIN: WBA8E9G50GNU12345\nЗаказ #7\nИтого: 1 850 RSD',
        country: null,
        source_url: 'https://carlab.rs/sr/parts/cart/',
        visitorId: '0f8fad5b-d9cb-469f-a165-70867728950e',
        adSource: expect.objectContaining({ source: 'google' }),
        metaIds: META_IDS,
        orderId: 'order_1',
        locale: 'ru',
      },
      '[shop-orders]',
    );
  });

  it('falls back to the default locale and leaves the optional fields empty', async () => {
    await call(placed({ locale: 'de' }));

    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '',
        comment: 'Заказ #7\nИтого: 1 850 RSD',
        source_url: null,
        visitorId: null,
        adSource: null,
        metaIds: null,
        locale: 'sr',
      }),
      '[shop-orders]',
    );
  });

  it.each(['javascript:alert(1)', 'https://evil.example/sr/parts/cart/'])(
    'stores no page for a source_url %s off the site',
    async (source_url) => {
      await call(placed({ source_url }));

      expect(notifyLead).toHaveBeenCalledWith(
        expect.objectContaining({ source_url: null }),
        '[shop-orders]',
      );
    },
  );

  it('answers 201 for a Lead delivered but not stored', async () => {
    notifyLead.mockResolvedValue({ stored: false, delivered: true });

    expect((await call(placed())).status).toBe(201);
  });

  it('answers 503 for a Lead neither stored nor delivered, so the shop retries', async () => {
    notifyLead.mockResolvedValue({ stored: false, delivered: false });

    expect((await call(placed())).status).toBe(503);
  });

  it.each([
    ['lost', 204],
    ['won', 409],
    ['missing', 410],
  ])('answers a cancel whose Lead is %s with %i', async (result, status) => {
    cancelOrder.mockResolvedValue(result);

    const response = await call({ event: 'canceled', order_id: 'order_1' });

    expect(response.status).toBe(status);
    expect(cancelOrder).toHaveBeenCalledWith('order_1');
    expect(notifyLead).not.toHaveBeenCalled();
  });
});
