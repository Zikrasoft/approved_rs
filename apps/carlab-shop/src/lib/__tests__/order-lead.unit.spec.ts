import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';

import { type LeadOrder, orderLeadForm } from '../order-lead';

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
        'Oil filter × 2: 3700 RSD',
        'Итого: 3700 RSD',
        'Pozvati posle 17h',
      ].join('\n'),
    );
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
      /\nНе поместилось позиций: \d+\nИтого: 20000 RSD\n/,
    );
    expect(comment.endsWith('Pozvati posle 17h')).toBe(true);
  });
});
