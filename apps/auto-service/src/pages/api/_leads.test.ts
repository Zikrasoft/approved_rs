import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PARTS_ORDER_SERVICE, serviceLabel } from '@podbor/brands';
import { LEADS_PATH } from '@podbor/lead-crm';
import {
  ORDER_CANCELED,
  ORDER_ID_FIELD,
  ORDER_OUTCOME_FIELD,
} from '@podbor/lead-crm/fields';
import { PARTS_ORDER_COPY } from '@podbor/lead-crm/parts-order-copy';
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

const pending = vi.hoisted(() => [] as Promise<unknown>[]);
const SHOP_LEAD_SECRET = vi.hoisted(() => {
  process.env.SHOP_LEAD_SECRET = 'shop-lead-secret';
  return process.env.SHOP_LEAD_SECRET;
});

vi.mock('@podbor/lead-crm/storage/local', () =>
  memory.module('localLeadStorage'),
);
vi.mock('@vercel/functions', () => ({
  waitUntil: (promise: Promise<unknown>) => pending.push(promise),
}));

import { POST } from './leads';

const api = recordBotApi();
vi.stubGlobal('fetch', api.fetch);

const GROUP_ID = '-1009876543210';

const orderForm = () =>
  new URLSearchParams({
    contact: '+381601234567',
    contact_channel: 'whatsapp',
    name: 'Ana',
    vin: 'WBA8E9G50GNU12345',
    locale: 'sr',
    comment: [
      PARTS_ORDER_COPY.heading(7),
      PARTS_ORDER_COPY.confirm,
      PARTS_ORDER_COPY.line('Mann-Filter HU 816 x', 1, '1 850 RSD'),
      PARTS_ORDER_COPY.total('1 850 RSD'),
    ].join('\n'),
    service: PARTS_ORDER_SERVICE,
    consent: '1',
    source_url: 'https://carlab.rs/sr/parts/cart/',
    visitor_id: '',
    [ORDER_ID_FIELD]: 'order_1',
  });

const post = (body: URLSearchParams, headers: Record<string, string> = {}) =>
  POST({
    request: new Request('http://localhost/api/leads', {
      method: 'POST',
      headers: { origin: 'http://localhost', ...headers },
      body,
    }),
    redirect: (path: string, status = 302) =>
      new Response(null, { status, headers: { location: path } }),
    cookies: { get: () => undefined },
  } as unknown as Parameters<typeof POST>[0]);

beforeEach(() => {
  api.reset();
  pending.length = 0;
});

describe('a placed parts order posted to /api/leads', () => {
  it('stores the order Lead and posts its card to the CRM group', async () => {
    const response = await post(orderForm());
    await Promise.all(pending);

    expect(response.status).toBe(302);
    expect(memory.storages.get(LEADS_PATH)?.current()).toEqual([
      expect.objectContaining({
        brand: 'CarLab',
        service: PARTS_ORDER_SERVICE,
        orderId: 'order_1',
        contact: '+381601234567',
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
    expect(cards[0]!.payload.text).toEqual(expect.stringContaining('CarLab'));
  });
});

describe('a parts order cancelled in the shop admin', () => {
  it('marks the order Lead lost once the shop proves who it is', async () => {
    await post(orderForm());
    await Promise.all(pending);
    const cancel = new URLSearchParams({
      [ORDER_ID_FIELD]: 'order_1',
      [ORDER_OUTCOME_FIELD]: ORDER_CANCELED,
    });

    const refused = await post(cancel);
    const response = await post(cancel, {
      authorization: `Bearer ${SHOP_LEAD_SECRET}`,
    });

    expect(refused.status).toBe(401);
    expect(response.status).toBe(204);
    expect(memory.storages.get(LEADS_PATH)?.current()).toEqual([
      expect.objectContaining({ orderId: 'order_1', status: 'lost' }),
    ]);
  });
});
