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
import { content } from '@/i18n/content';
import { DEMAND_PARTS_FIELD } from '@/utils/demand';

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

const demand = vi.hoisted(() => ({ inquiries: [] as FormData[] }));
vi.mock('@/lib/shopEvents', async (original) => ({
  ...(await original<typeof import('@/lib/shopEvents')>()),
  reportInquiryDemand: (_: Request, form: FormData) =>
    demand.inquiries.push(form),
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

const shop = { authorization: `Bearer ${SHOP_LEAD_SECRET}` };

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
  demand.inquiries.length = 0;
});

describe('a placed parts order posted to /api/leads', () => {
  it('refuses an order Lead the shop did not prove it sent', async () => {
    const response = await post(orderForm());
    await Promise.all(pending);

    expect(response.status).toBe(401);
    expect(memory.storages.get(LEADS_PATH)?.current() ?? []).toEqual([]);
  });

  it('stores the order Lead and posts its card to the CRM group', async () => {
    const response = await post(orderForm(), shop);
    await Promise.all(pending);

    expect(response.status).toBe(201);
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
    await post(orderForm(), shop);
    await Promise.all(pending);
    const cancel = new URLSearchParams({
      [ORDER_ID_FIELD]: 'order_1',
      [ORDER_OUTCOME_FIELD]: ORDER_CANCELED,
    });

    const refused = await post(cancel);
    const response = await post(cancel, shop);

    expect(refused.status).toBe(401);
    expect(response.status).toBe(204);
    expect(memory.storages.get(LEADS_PATH)?.current()).toEqual([
      expect.objectContaining({ orderId: 'order_1', status: 'lost' }),
    ]);
  });
});

describe('the thanks page a lead lands on', () => {
  const inquiry = (service: string) =>
    new URLSearchParams({
      contact: '+381601234567',
      contact_channel: 'whatsapp',
      name: '',
      locale: 'sr',
      service,
      source_url: 'https://carlab.rs/sr/parts/',
      visitor_id: '',
    });

  it('thanks a parts inquiry on the parts variant', async () => {
    const response = await post(inquiry('vin-parts-inquiry'));
    expect(response.headers.get('location')).toBe('/sr/thanks/parts/');
  });

  it('counts the parts an accepted inquiry named as demand', async () => {
    const form = inquiry('vin-parts-inquiry');
    form.append(DEMAND_PARTS_FIELD, 'mann-filter-hu816x');

    await post(form);

    expect(
      demand.inquiries.map((sent) => sent.getAll(DEMAND_PARTS_FIELD)),
    ).toEqual([['mann-filter-hu816x']]);
  });

  it('counts no demand for an inquiry it refuses', async () => {
    const form = inquiry('vin-parts-inquiry');
    form.set('contact', '12');
    form.set('contact_channel', 'phone');
    form.append(DEMAND_PARTS_FIELD, 'mann-filter-hu816x');

    expect((await post(form)).status).toBe(400);
    expect(demand.inquiries).toEqual([]);
  });

  it('counts no demand for a body that is not a form', async () => {
    await POST({
      request: new Request('http://localhost/api/leads', {
        method: 'POST',
        headers: { origin: 'http://localhost', 'content-type': 'text/plain' },
        body: 'demand_parts=bosch-1',
      }),
      redirect: (path: string, status = 302) =>
        new Response(null, { status, headers: { location: path } }),
      cookies: { get: () => undefined },
    } as unknown as Parameters<typeof POST>[0]);

    expect(demand.inquiries).toEqual([]);
  });

  it('thanks a service lead on the generic page', async () => {
    const response = await post(inquiry('diagnostics'));
    expect(response.headers.get('location')).toBe('/sr/thanks/');
  });
});

describe('a lead the server cannot take', () => {
  it('asks for the contact again under the privacy notice, with no box to tick', async () => {
    const { site } = content('sr');
    const response = await post(
      new URLSearchParams({ phone_number: '12', locale: 'sr' }),
    );
    const page = await response.text();

    expect(response.status).toBe(400);
    expect(page).not.toContain('type="checkbox"');
    expect(page).toContain(
      `<p>${site.form.privacyNotice} <a href="/sr/privacy/" target="_blank">${site.form.privacyLinkText}</a></p>`,
    );
  });
});
