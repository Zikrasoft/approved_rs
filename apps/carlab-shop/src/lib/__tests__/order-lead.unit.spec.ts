import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';

import { type LeadOrder, orderLeadForm, sendOrderLead } from '../order-lead';

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

describe('orderLeadForm', () => {
  it('puts the car before the lines and the total and note after them', () => {
    const form = orderLeadForm(order());

    expect(form.get('service')).toBe('parts-order');
    expect(form.get('vin')).toBe('WBA35BG070N074158');
    expect(form.get('comment')).toBe(
      [
        'Заказ #12, самовывоз, оплата при получении',
        'BMW 3 серия F30 320d, B47D20O0',
        'Oil filter × 2: 3\u00a0700 RSD',
        'Итого: 3\u00a0700 RSD',
        'Pozvati posle 17h',
      ].join('\n'),
    );
  });

  it('hands the lead route the attribution the checkout form carried', () => {
    const form = orderLeadForm(
      order({
        metadata: {
          contact: '+381601234567',
          source_url: 'https://carlab.rs/ru/parts/cart/',
          visitor_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
          ad_source: '{"utm_source":"google"}',
          meta_ids: '{"fbp":"fb.1.1.1"}',
        },
      }),
    );

    expect(Object.fromEntries(form)).toMatchObject({
      source_url: 'https://carlab.rs/ru/parts/cart/',
      visitor_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
      ad_source: '{"utm_source":"google"}',
      meta_ids: '{"fbp":"fb.1.1.1"}',
    });
  });

  it('writes sums with thousands separated for the owner', () => {
    const comment =
      orderLeadForm(
        order({ items: [{ title: 'Oil', unit_price: 2400, quantity: 1 }] }),
      ).get('comment') ?? '';

    expect(comment).toContain('Итого: 2\u00a0400 RSD');
  });

  it('caps the comment at the lead limit and counts the lines left out', () => {
    const items = Array.from({ length: 200 }, (_, index) => ({
      title: `Part ${index} ${'x'.repeat(20)}`,
      unit_price: 100,
      quantity: 1,
    }));

    const comment = orderLeadForm(order({ items })).get('comment') ?? '';

    expect(comment.length).toBeLessThanOrEqual(MAX_COMMENT_LENGTH);
    expect(comment).toMatch(
      /\nНе поместилось позиций: \d+\nИтого: 20\u00a0000 RSD\n/,
    );
    expect(comment.endsWith('Pozvati posle 17h')).toBe(true);
  });
});

describe('sendOrderLead', () => {
  it('posts as the lead route origin, so the storefront CSRF check lets it in', async () => {
    let origin: string | undefined;
    const server = createServer((request, response) => {
      origin = request.headers.origin;
      response.writeHead(302, { location: '/ru/thanks/' }).end();
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    try {
      await sendOrderLead(
        `http://localhost:${port}/api/leads`,
        new URLSearchParams({ contact: '+381601234567' }),
      );
    } finally {
      server.close();
    }

    expect(origin).toBe(`http://localhost:${port}`);
  });
});
