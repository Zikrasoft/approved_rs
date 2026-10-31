import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';

import {
  alertOwner,
  type LeadOrder,
  orderLeadPayload,
  sendShopOrderEvent,
} from '../order-lead';

const ADMIN = 'https://admin.carlab.rs';

const order = (overrides: Partial<LeadOrder> = {}): LeadOrder => ({
  id: 'order_1',
  display_id: 12,
  currency_code: 'rsd',
  metadata: {
    contact: '+381601234567',
    contact_channel: 'whatsapp',
    vin: 'WBA35BG070N074158',
    car: 'BMW 3 серия F30 320d, B47D20O0',
    comment: 'Pozvati posle 17h',
    locale: 'sr',
  },
  items: [{ title: 'Oil filter', unit_price: 1850, quantity: 2 }],
  ...overrides,
});

const summaryOf = (lead: LeadOrder) => orderLeadPayload(lead, ADMIN).summary;

describe('orderLeadPayload', () => {
  it('puts the car before the lines and the total and note after them', () => {
    const payload = orderLeadPayload(order(), ADMIN);

    expect(payload).toMatchObject({
      event: 'placed',
      order_id: 'order_1',
      contact: { contact: '+381601234567', vin: 'WBA35BG070N074158' },
    });
    expect(payload.summary).toBe(
      [
        'Заказ #12, самовывоз, оплата при получении',
        'Нужно подтвердить наличие и время самовывоза',
        'BMW 3 серия F30 320d, B47D20O0',
        'Oil filter × 2: 3\u00a0700 RSD',
        'Итого: 3\u00a0700 RSD',
        'Pozvati posle 17h',
      ].join('\n'),
    );
  });

  it('hands the CRM the attribution the checkout form carried', () => {
    const { contact } = orderLeadPayload(
      order({
        metadata: {
          contact: '+381601234567',
          source_url: 'https://carlab.rs/ru/parts/cart/',
          visitor_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
          ad_source: '{"utm_source":"google"}',
          meta_ids: '{"fbp":"fb.1.1.1"}',
        },
      }),
      ADMIN,
    );

    expect(contact).toMatchObject({
      source_url: 'https://carlab.rs/ru/parts/cart/',
      visitor_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
      ad_source: '{"utm_source":"google"}',
      meta_ids: '{"fbp":"fb.1.1.1"}',
    });
  });

  it('says on each line when it can be picked up', () => {
    const line = (in_stock: boolean, lead_time_days: number) => ({
      title: 'Oil',
      unit_price: 100,
      quantity: 1,
      metadata: { in_stock, lead_time_days },
    });
    const comment = summaryOf(
      order({
        items: [line(true, 0), line(true, 2), line(false, 1), line(false, 5)],
      }),
    );

    expect(comment.split('\n').slice(3, 7)).toEqual([
      'Oil × 1: 100 RSD, в наличии',
      'Oil × 1: 100 RSD, в наличии, забрать через 2 дня',
      'Oil × 1: 100 RSD, забрать через 1 день',
      'Oil × 1: 100 RSD, забрать через 5 дней',
    ]);
  });

  it('names the supplier, so two lines of one part from two suppliers differ', () => {
    const line = (supplier: string) => ({
      title: 'Pads',
      unit_price: 100,
      quantity: 1,
      metadata: { in_stock: true, lead_time_days: 0, supplier },
    });
    const comment = summaryOf(
      order({ items: [line('Intercars'), line('Autodelovi')] }),
    );

    expect(comment.split('\n').slice(3, 5)).toEqual([
      'Pads × 1: 100 RSD, в наличии, Intercars',
      'Pads × 1: 100 RSD, в наличии, Autodelovi',
    ]);
  });

  it('prints each add-on under its own line, whatever order the order keeps them in', () => {
    const comment = summaryOf(
      order({
        items: [
          {
            title: 'Установка в сервисе CarLab',
            unit_price: 0,
            quantity: 1,
            metadata: {
              addon_for: 'cali_2',
              addon_offer_id: 'offer_battery',
              addon_kind: 'installation',
            },
          },
          {
            title: 'Oil filter',
            unit_price: 1850,
            quantity: 1,
            metadata: { offer_id: 'offer_oil' },
          },
          {
            title: 'Регистрация аккумулятора',
            unit_price: 2500,
            quantity: 1,
            metadata: {
              addon_for: 'cali_2',
              addon_offer_id: 'offer_battery',
            },
          },
          {
            title: 'Varta',
            unit_price: 10000,
            quantity: 1,
            metadata: { offer_id: 'offer_battery' },
          },
          {
            title: 'Установка в сервисе CarLab',
            unit_price: 1000,
            quantity: 1,
            metadata: {
              addon_for: 'cali_1',
              addon_offer_id: 'offer_oil',
              addon_kind: 'installation',
            },
          },
        ],
      }),
    );

    expect(comment.split('\n').slice(3, 9)).toEqual([
      'Oil filter × 1: 1\u00a0850 RSD',
      '+ Установка в сервисе CarLab: 1\u00a0000 RSD',
      'Varta × 1: 10\u00a0000 RSD',
      '+ Регистрация аккумулятора: 2\u00a0500 RSD',
      '+ Установка в сервисе CarLab: бесплатно',
      'Итого: 15\u00a0350 RSD',
    ]);
  });

  it('groups add-ons linked only by the parent Offer id like a beta order', () => {
    const comment = summaryOf(
      order({
        items: [
          {
            title: 'Регистрация аккумулятора',
            unit_price: 2500,
            quantity: 1,
            metadata: {
              addon_offer_id: 'offer_battery',
              addon_kind: 'service',
            },
          },
          {
            title: 'Oil filter',
            unit_price: 1850,
            quantity: 1,
            metadata: { offer_id: 'offer_oil' },
          },
          {
            title: 'Varta',
            unit_price: 10000,
            quantity: 1,
            metadata: { offer_id: 'offer_battery' },
          },
        ],
      }),
    );

    expect(comment.split('\n').slice(3, 7)).toEqual([
      'Oil filter × 1: 1 850 RSD',
      'Varta × 1: 10 000 RSD',
      '+ Регистрация аккумулятора: 2 500 RSD',
      'Итого: 14 350 RSD',
    ]);
  });

  it('writes sums with thousands separated for the owner', () => {
    const comment = summaryOf(
      order({ items: [{ title: 'Oil', unit_price: 2400, quantity: 1 }] }),
    );

    expect(comment).toContain('Итого: 2\u00a0400 RSD');
  });

  it('caps the comment at the lead limit and counts the lines left out', () => {
    const items = Array.from({ length: 200 }, (_, index) => ({
      title: `Part ${index} ${'x'.repeat(20)}`,
      unit_price: 100,
      quantity: 1,
    }));

    const comment = summaryOf(order({ items }));

    expect(comment.length).toBeLessThanOrEqual(MAX_COMMENT_LENGTH);
    expect(comment).toMatch(
      /\nНе поместилось позиций: \d+, весь заказ: https:\/\/admin\.carlab\.rs\/app\/orders\/order_1\nИтого: 20\u00a0000 RSD\n/,
    );
    expect(comment.endsWith('Pozvati posle 17h')).toBe(true);
  });
});

describe('sendShopOrderEvent', () => {
  const placed = orderLeadPayload(order(), ADMIN);

  async function serve(
    answer: (path: string) => number,
    run: (url: string) => Promise<unknown>,
  ) {
    const seen: {
      path?: string;
      type?: string;
      auth?: string;
      body: string;
    }[] = [];
    const server = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        seen.push({
          path: request.url,
          type: request.headers['content-type'],
          auth: request.headers.authorization,
          body,
        });
        response.writeHead(answer(request.url ?? '')).end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    try {
      await run(`http://localhost:${port}/api/leads`);
    } finally {
      server.close();
    }
    return seen;
  }

  it('posts the event as JSON to the shop orders route', async () => {
    const seen = await serve(
      () => 201,
      (url) => sendShopOrderEvent(url, placed, 's3cret'),
    );

    expect(seen).toEqual([
      {
        path: '/api/shop-orders',
        type: 'application/json',
        auth: 'Bearer s3cret',
        body: JSON.stringify(placed),
      },
    ]);
  });

  it.each([302, 410, 503])(
    'takes a %i for a refusal, as only a 2xx means the CRM has it',
    async (status) => {
      await serve(
        () => status,
        (url) =>
          expect(sendShopOrderEvent(url, placed, 's3cret')).rejects.toThrow(
            `The lead route answered ${status}`,
          ),
      );
    },
  );

  it('falls back to the lead form route of a storefront without the shop orders route', async () => {
    const seen = await serve(
      (path) => (path === '/api/shop-orders' ? 404 : 302),
      (url) => sendShopOrderEvent(url, placed, 's3cret'),
    );

    expect(seen.map(({ path }) => path)).toEqual([
      '/api/shop-orders',
      '/api/leads',
    ]);
    expect(Object.fromEntries(new URLSearchParams(seen[1]!.body))).toEqual({
      contact: '+381601234567',
      contact_channel: 'whatsapp',
      name: '',
      vin: 'WBA35BG070N074158',
      locale: 'sr',
      comment: placed.summary,
      service: 'parts-order',
      consent: '1',
      source_url: '',
      visitor_id: '',
      ad_source: '',
      meta_ids: '',
      order_id: 'order_1',
    });
  });

  it('sends a cancel to the old route as the old form, and its refusal back', async () => {
    let body = '';
    await serve(
      () => 404,
      (url) =>
        expect(
          sendShopOrderEvent(
            url,
            { event: 'canceled', order_id: 'order_1' },
            's3cret',
          ),
        ).rejects.toThrow('The lead route answered 404'),
    ).then((seen) => (body = seen[1]!.body));

    expect(Object.fromEntries(new URLSearchParams(body))).toEqual({
      order_id: 'order_1',
      order_outcome: 'canceled',
    });
  });
});

describe('alertOwner', () => {
  const saved = { ...process.env };
  let posted: { path?: string; body?: unknown };
  let reply: string;
  let root: string;
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      posted = { path: request.url, body: JSON.parse(body) };
      response.end(reply);
    });
  });

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    root = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());
  beforeEach(() => {
    posted = {};
    reply = '{"ok":true,"result":{}}';
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
    process.env.TELEGRAM_GROUP_ID = '-100123';
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('posts the message to the CRM group through the Bot API', async () => {
    expect(await alertOwner('Заказ #12 не дошел', root)).toBe(true);
    expect(posted).toEqual({
      path: '/botbot-token/sendMessage',
      body: { chat_id: '-100123', text: 'Заказ #12 не дошел' },
    });
  });

  it('reports a message Telegram refused', async () => {
    reply = '{"ok":false,"description":"chat not found"}';

    expect(await alertOwner('text', root)).toBe(false);
  });

  it('reports an unreachable Bot API instead of throwing', async () => {
    expect(await alertOwner('text', 'http://localhost:1')).toBe(false);
  });

  it('sends nothing while the bot is not configured', async () => {
    delete process.env.TELEGRAM_GROUP_ID;

    expect(await alertOwner('text', root)).toBe(false);
    expect(posted).toEqual({});
  });
});
