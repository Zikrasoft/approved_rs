import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PARTS_ORDER_SERVICE, serviceLabel } from '@podbor/brands';
import { LEADS_PATH } from '@podbor/lead-crm';
import { PARTS_ORDER_COPY } from '@podbor/lead-crm/parts-order-copy';
import type { ShopOrderEvent } from '@podbor/lead-crm/shop-orders-wire';
import { recordBotApi, type MemoryStorage } from '@podbor/lead-crm/testing';

const memory = vi.hoisted(() => {
  const storages = new Map<string, MemoryStorage>();
  return {
    storages,
    async module(name: string) {
      const { createMemoryStorage } = await import('@podbor/lead-crm/testing');
      const storageAt = (path: string) => {
        if (!storages.has(path)) storages.set(path, createMemoryStorage());
        return storages.get(path)!;
      };
      return { [name]: storageAt };
    },
  };
});

const SHOP_LEAD_SECRET = vi.hoisted(() => {
  process.env.SHOP_LEAD_SECRET = 'shop-lead-secret';
  return process.env.SHOP_LEAD_SECRET;
});

vi.mock('@podbor/lead-crm/storage/local', () =>
  memory.module('localLeadStorage'),
);

import { POST } from './shop-orders';

const api = recordBotApi();
vi.stubGlobal('fetch', api.fetch);

const GROUP_ID = '-1009876543210';

const placed: ShopOrderEvent = {
  event: 'placed',
  order_id: 'order_1',
  contact: {
    contact: '+381601234567',
    contact_channel: 'whatsapp',
    name: 'Ana',
    vin: 'WBA8E9G50GNU12345',
    locale: 'sr',
    source_url: 'https://carlab.rs/sr/parts/cart/',
  },
  summary: [
    PARTS_ORDER_COPY.heading(7),
    PARTS_ORDER_COPY.confirm,
    PARTS_ORDER_COPY.line('Mann-Filter HU 816 x', 1, '1 850 RSD'),
    PARTS_ORDER_COPY.total('1 850 RSD'),
  ].join('\n'),
};

const post = (body: ShopOrderEvent, authorization?: string) =>
  POST({
    request: new Request('http://localhost/api/shop-orders', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify(body),
    }),
  });

const shop = `Bearer ${SHOP_LEAD_SECRET}`;

beforeEach(() => {
  api.reset();
});

describe('a placed parts order posted to /api/shop-orders', () => {
  it('refuses an order the shop did not prove it sent', async () => {
    const response = await post(placed);

    expect(response.status).toBe(401);
    expect(memory.storages.get(LEADS_PATH)?.current() ?? []).toEqual([]);
  });

  it('stores the order Lead before answering, then marks it lost on a cancel', async () => {
    const response = await post(placed, shop);

    expect(response.status).toBe(201);
    expect(memory.storages.get(LEADS_PATH)?.current()).toEqual([
      expect.objectContaining({
        brand: 'CarLab',
        service: PARTS_ORDER_SERVICE,
        orderId: 'order_1',
        contact: '+381601234567',
        locale: 'sr',
        comment: expect.stringContaining(PARTS_ORDER_COPY.heading(7)),
      }),
    ]);
    const cards = api
      .callsTo('sendMessage', '1001:test-bot-token')
      .filter(({ payload }) => payload.chat_id === GROUP_ID);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.payload.text).toEqual(
      expect.stringContaining(serviceLabel(PARTS_ORDER_SERVICE)),
    );

    const canceled = await post(
      { event: 'canceled', order_id: 'order_1' },
      shop,
    );

    expect(canceled.status).toBe(204);
    expect(memory.storages.get(LEADS_PATH)?.current()).toEqual([
      expect.objectContaining({ orderId: 'order_1', status: 'lost' }),
    ]);
  });
});
