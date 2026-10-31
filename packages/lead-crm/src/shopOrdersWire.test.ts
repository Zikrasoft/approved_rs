import { describe, expect, it } from 'vitest';
import { orderOutcomePath, shopOrderEventSchema } from './shopOrdersWire.ts';

describe('the shop orders wire', () => {
  it('escapes the order id in the outcome hook path', () => {
    expect(orderOutcomePath('order/1')).toBe(
      '/hooks/carlab-orders/order%2F1/outcome',
    );
  });

  it('stores the contact the way the lead form does and drops blank fields', () => {
    expect(
      shopOrderEventSchema.parse({
        event: 'placed',
        order_id: 'order_1',
        contact: {
          contact: ' +381 60 1234567 ',
          contact_channel: 'pigeon',
          name: '',
          visitor_id: '  ',
        },
        summary: 'Заказ #1',
      }),
    ).toEqual({
      event: 'placed',
      order_id: 'order_1',
      contact: { contact: '+381601234567' },
      summary: 'Заказ #1',
    });
  });

  it('refuses a contact the lead form would refuse', () => {
    expect(
      shopOrderEventSchema.safeParse({
        event: 'placed',
        order_id: 'order_1',
        contact: { contact: 'call me' },
        summary: 'Заказ #1',
      }).success,
    ).toBe(false);
  });
});
