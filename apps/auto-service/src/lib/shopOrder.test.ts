import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFormatter } from '@podbor/lead-crm';
import { formatPrice } from '@podbor/shop-catalog/browser';
import { ORDER_HOOK_HEADER, signHook } from '@podbor/shop-catalog/order-hook';
import { leadSchema } from './crm';
import {
  createShopOrderHandler,
  orderComment,
  orderLead,
  readHookSecret,
} from './shopOrder';

const SECRET = 'x'.repeat(40);
const NOW = 1_790_000_000_000;

const ORDER = {
  orderId: 'order_01',
  displayId: 12,
  locale: 'sr',
  customer: {
    name: 'Marko Marković',
    phone: '+381601234567',
    email: 'kupac@example.com',
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
  comment: 'Posle 17h',
  adminUrl: 'https://api.carlab.rs/app/orders/order_01',
} as const;

const signed = (body: unknown, secret = SECRET) => {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://carlab.rs/api/shop-order', {
    method: 'POST',
    headers: { [ORDER_HOOK_HEADER]: signHook(text, secret, NOW) },
    body: text,
  });
};

const memoryMarkers = () => {
  const seen = new Set<string>();
  return {
    seen,
    has: vi.fn(async (id: string) => seen.has(id)),
    add: vi.fn(async (id: string) => void seen.add(id)),
    release: vi.fn(async (id: string) => void seen.delete(id)),
  };
};

const outcome = (stored: boolean, delivered: boolean) => ({
  stored,
  delivered,
});

let markers: ReturnType<typeof memoryMarkers>;
const notifyLead = vi.fn();
const handler = (...args: [string | undefined] | []) =>
  createShopOrderHandler({
    secret: args.length ? args[0] : SECRET,
    notifyLead,
    markers,
    now: () => NOW,
  });

beforeEach(() => {
  markers = memoryMarkers();
  notifyLead.mockReset().mockResolvedValue(outcome(true, true));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('shop order receiver', () => {
  it('accepts a signed order and posts one card for it', async () => {
    const response = await handler()(signed(ORDER));

    expect(response.status).toBe(202);
    expect(notifyLead).toHaveBeenCalledTimes(1);
    expect(notifyLead.mock.calls[0][0]).toMatchObject({
      name: 'Marko Marković',
      contact: '+381601234567',
      contactChannel: 'telegram',
      service: 'parts-order',
      locale: 'sr',
      source_url: ORDER.adminUrl,
      visitorId: null,
    });
    expect(markers.seen.has('order_01')).toBe(true);
  });

  it('answers a retried delivery as a duplicate without a second card', async () => {
    await handler()(signed(ORDER));
    const again = await handler()(signed(ORDER));

    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ duplicate: true });
    expect(notifyLead).toHaveBeenCalledTimes(1);
  });

  it('stores the lead once even when the card did not go out', async () => {
    notifyLead.mockResolvedValueOnce(outcome(true, false));

    const first = await handler()(signed(ORDER));
    expect(first.status).toBe(502);
    expect(markers.seen.has('order_01')).toBe(true);
    expect(markers.release).not.toHaveBeenCalled();

    const retry = await handler()(signed(ORDER));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ duplicate: true });
    expect(notifyLead).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no card went out', false],
    ['the card went out', true],
  ])(
    'releases the marker and asks for a retry when nothing was stored and %s',
    async (_label, delivered) => {
      notifyLead.mockResolvedValueOnce(outcome(false, delivered));

      const first = await handler()(signed(ORDER));
      expect(first.status).toBe(502);
      expect(await first.json()).toEqual({ delivered: false });
      expect(markers.seen.has('order_01')).toBe(false);

      const retry = await handler()(signed(ORDER));
      expect(retry.status).toBe(202);
      expect(notifyLead).toHaveBeenCalledTimes(2);
      expect(markers.seen.has('order_01')).toBe(true);

      const third = await handler()(signed(ORDER));
      expect(third.status).toBe(200);
      expect(notifyLead).toHaveBeenCalledTimes(2);
    },
  );

  it('still answers 502 when the marker could not be released', async () => {
    notifyLead.mockResolvedValueOnce(outcome(false, false));
    markers.release.mockRejectedValueOnce(new Error('blob down'));

    const response = await handler()(signed(ORDER));

    expect(response.status).toBe(502);
    expect(console.error).toHaveBeenCalledWith(
      '[shop-order] cannot release the order marker',
      expect.objectContaining({ orderId: 'order_01' }),
    );
  });

  it('asks for a retry when the marker could not be written, storing nothing', async () => {
    markers.add.mockRejectedValueOnce(new Error('blob down'));

    expect((await handler()(signed(ORDER))).status).toBe(503);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('asks for a retry when it cannot tell whether the order was seen', async () => {
    markers.has.mockRejectedValueOnce(new Error('blob down'));

    expect((await handler()(signed(ORDER))).status).toBe(503);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it.each([
    [
      'no signature',
      new Request('https://carlab.rs/api/shop-order', {
        method: 'POST',
        body: JSON.stringify(ORDER),
      }),
    ],
    ['the wrong secret', signed(ORDER, 'y'.repeat(40))],
  ])('refuses %s with 401', async (_label, request) => {
    expect((await handler()(request)).status).toBe(401);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('checks the signature on the exact bytes that were sent', async () => {
    const request = signed(ORDER);
    const tampered = new Request(request, {
      body: JSON.stringify({ ...ORDER, total: 1 }),
    });

    expect((await handler()(tampered)).status).toBe(401);
  });

  it.each([
    ['not JSON', 'not json'],
    ['a payload the schema refuses', { ...ORDER, total: -1 }],
  ])('refuses %s with 400', async (_label, body) => {
    expect((await handler()(signed(body))).status).toBe(400);
  });

  it('refuses to run without a configured secret', async () => {
    expect((await handler(undefined)(signed(ORDER))).status).toBe(500);
  });
});

describe('the card text', () => {
  it('lists the items, the total and the pickup terms in Russian', () => {
    const rsd = (amount: number) => formatPrice(amount, 'ru-RU');

    expect(orderComment(ORDER as never).split('\n')).toEqual([
      'Заказ #12 · самовывоз · оплата при получении',
      `• Varta Blue Dynamic E12 × 1 — ${rsd(11190)}`,
      `• Установка аккумулятора × 1 — ${rsd(1500)}`,
      `Итого: ${rsd(12690)}`,
      'Email: kupac@example.com',
      'Комментарий покупателя: Posle 17h',
    ]);
  });

  it('drops a contact channel it does not know', () => {
    const lead = orderLead({
      ...ORDER,
      customer: { ...ORDER.customer, channel: 'pigeon' },
    } as never);

    expect(lead.contactChannel).toBeNull();
  });

  it('delivers the Medusa total even when the items do not add up, and says so in the log', () => {
    const text = orderComment({ ...ORDER, total: 99999 } as never);

    expect(text).toContain(`Итого: ${formatPrice(99999, 'ru-RU')}`);
    expect(console.error).toHaveBeenCalledWith(
      '[shop-order] items do not add up',
      expect.objectContaining({ orderId: 'order_01', total: 99999 }),
    );
  });

  it('fits Telegram and escapes markup exactly once, however big the order', () => {
    const worst = {
      ...ORDER,
      customer: { ...ORDER.customer, name: '&'.repeat(200) },
      items: Array.from({ length: 100 }, () => ({
        title: '<'.repeat(300),
        quantity: 1000,
        unitPrice: 999999,
        isService: false,
      })),
      comment: '&'.repeat(2000),
    };
    const lead = leadSchema.parse({
      ...orderLead(worst as never),
      brand: 'CarLab',
      id: 1,
      statusChangedAt: '2026-09-29T00:00:00.000Z',
      createdAt: '2026-09-29T00:00:00.000Z',
    });

    const card = createFormatter({
      serviceLabel: (slug) => slug,
      botUsername: 'carlab_bot',
    }).formatLeadText(lead, 'owner');

    expect(card.length).toBeLessThanOrEqual(4096);
    expect(card).toContain('&lt;');
    expect(card).not.toContain('&amp;lt;');
    expect(card).toContain('…');
  });
});

describe('readHookSecret', () => {
  it('takes a long enough secret and nothing else', () => {
    expect(readHookSecret({ SHOP_ORDER_HOOK_SECRET: ` ${SECRET} ` })).toBe(
      SECRET,
    );
    expect(readHookSecret({ SHOP_ORDER_HOOK_SECRET: 'short' })).toBeUndefined();
    expect(readHookSecret({})).toBeUndefined();
  });
});
