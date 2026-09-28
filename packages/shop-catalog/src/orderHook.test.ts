import { describe, it, expect } from 'vitest';
import {
  ORDER_HOOK_HEADER,
  ORDER_HOOK_TOLERANCE_SECONDS,
  orderHookSchema,
  signHook,
  verifyHook,
} from './orderHook.ts';

const SECRET = 'test-secret';
const NOW = 1_790_000_000_000;
const BODY = JSON.stringify({ orderId: 'order_1' });

const PAYLOAD = {
  orderId: 'order_01',
  displayId: 12,
  locale: 'ru',
  customer: {
    name: 'Иван',
    phone: '+381641234567',
    email: 'ivan@example.com',
    channel: 'telegram',
  },
  items: [
    {
      title: 'Varta Blue Dynamic E12',
      quantity: 1,
      unitPrice: 11190,
      isService: false,
    },
    {
      title: 'Установка аккумулятора',
      quantity: 1,
      unitPrice: 1500,
      isService: true,
    },
  ],
  total: 12690,
  comment: 'Заеду в субботу',
  adminUrl: 'https://admin.carlab.rs/app/orders/order_01',
};

describe('signHook / verifyHook', () => {
  it('names the header and the tolerance', () => {
    expect(ORDER_HOOK_HEADER).toBe('x-carlab-signature');
    expect(ORDER_HOOK_TOLERANCE_SECONDS).toBe(300);
  });

  it('accepts its own signature', () => {
    const header = signHook(BODY, SECRET, NOW);
    expect(header).toMatch(/^t=1790000000,v1=[0-9a-f]{64}$/);
    expect(verifyHook(BODY, header, SECRET, NOW)).toBe(true);
  });

  it('signs with the current time by default', () => {
    expect(verifyHook(BODY, signHook(BODY, SECRET), SECRET)).toBe(true);
  });

  it('refuses a tampered body or a different secret', () => {
    const header = signHook(BODY, SECRET, NOW);
    expect(verifyHook(`${BODY} `, header, SECRET, NOW)).toBe(false);
    expect(verifyHook(BODY, header, 'other-secret', NOW)).toBe(false);
  });

  it('accepts the edge of the window and refuses beyond it, both ways', () => {
    const header = signHook(BODY, SECRET, NOW);
    const edge = ORDER_HOOK_TOLERANCE_SECONDS * 1000;
    expect(verifyHook(BODY, header, SECRET, NOW + edge)).toBe(true);
    expect(verifyHook(BODY, header, SECRET, NOW + edge + 1000)).toBe(false);
    expect(verifyHook(BODY, header, SECRET, NOW - edge - 1000)).toBe(false);
  });

  it.each([
    null,
    '',
    'nonsense',
    't=abc,v1=' + 'a'.repeat(64),
    't=1790000000',
    't=1790000000,v1=abc',
    't=1790000000,v1=' + 'z'.repeat(64),
  ])('refuses the malformed header %j', (header) => {
    expect(verifyHook(BODY, header, SECRET, NOW)).toBe(false);
  });

  it('never trusts an empty secret on either side', () => {
    expect(() => signHook(BODY, '', NOW)).toThrow('order hook secret is empty');
    const forged = `t=1790000000,v1=${'0'.repeat(64)}`;
    expect(verifyHook(BODY, forged, '', NOW)).toBe(false);
  });
});

describe('orderHookSchema', () => {
  it('accepts a full order', () => {
    expect(orderHookSchema.parse(PAYLOAD)).toEqual(PAYLOAD);
  });

  it('accepts an order without optional channel and comment', () => {
    const bare = {
      ...PAYLOAD,
      comment: undefined,
      customer: { ...PAYLOAD.customer, channel: undefined },
    };
    expect(orderHookSchema.safeParse(bare).success).toBe(true);
  });

  it.each([
    [
      'a local phone number',
      { customer: { ...PAYLOAD.customer, phone: '0641234567' } },
    ],
    ['a bad email', { customer: { ...PAYLOAD.customer, email: 'nope' } }],
    ['a blank name', { customer: { ...PAYLOAD.customer, name: ' ' } }],
    ['no items', { items: [] }],
    ['a zero quantity', { items: [{ ...PAYLOAD.items[0], quantity: 0 }] }],
    ['a negative price', { items: [{ ...PAYLOAD.items[0], unitPrice: -1 }] }],
    ['an unknown locale', { locale: 'de' }],
    ['an extra key', { coupon: 'X' }],
    ['a non-URL admin link', { adminUrl: 'orders/1' }],
    ['a comment over 2000 characters', { comment: 'x'.repeat(2001) }],
  ])('rejects %s', (_label, patch) => {
    expect(orderHookSchema.safeParse({ ...PAYLOAD, ...patch }).success).toBe(
      false,
    );
  });
});
