import { describe, expect, it } from 'vitest';
import {
  cancelRefused,
  orderOutcomePath,
  outcomeRefused,
  shopOrderEventSchema,
} from './shopOrdersWire.ts';

describe('the final refusals on the shop orders wire', () => {
  it.each([
    [404, { type: 'order_missing' }, true],
    [404, { type: 'not_found' }, false],
    [404, null, false],
    [409, null, true],
    [410, { type: 'order_missing' }, false],
    [500, null, false],
  ])(
    'reads a shop answering %i %j to an outcome as final: %s',
    (status, body, final) => {
      expect(outcomeRefused(status, body)).toBe(final);
    },
  );

  it.each([
    [404, true],
    [409, true],
    [410, true],
    [503, false],
  ])('reads the CRM answering %i to a cancel as final: %s', (status, final) => {
    expect(cancelRefused(status)).toBe(final);
  });
});

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
