import {
  ORDER_HOOK_HEADER,
  ORDER_HOOK_LIMITS,
  orderHookSchema,
  verifyHook,
} from '@podbor/shop-catalog/order-hook';

import {
  type HookOrder,
  buildOrderHookPayload,
  sendOrderHook,
} from '../order-hook';

const ADMIN = 'https://api.carlab.rs/app';
const HOOK_URL = 'https://carlab.rs/api/shop-order';
const SECRET = 's'.repeat(32);

const ORDER: HookOrder = {
  id: 'order_1',
  display_id: 7,
  email: 'kupac@example.com',
  locale: 'sr-RS',
  total: 12690,
  metadata: { comment: 'Posle 17h', contact_channel: 'viber', website: '' },
  shipping_address: {
    first_name: 'Marko',
    last_name: 'Marković',
    phone: '+381601234567',
  },
  items: [
    {
      product_id: 'prod_bat',
      product_title: 'Bosch S4 024 (sr)',
      quantity: 1,
      unit_price: 11190,
    },
    {
      product_id: 'prod_inst',
      product_title: 'Ugradnja akumulatora',
      quantity: 1,
      unit_price: 1500,
    },
  ],
};

const PRODUCTS = [
  { id: 'prod_bat', title: 'Bosch S4 024', type: { value: 'batteries' } },
  {
    id: 'prod_inst',
    title: 'Установка аккумулятора',
    type: { value: 'services' },
  },
];

describe('buildOrderHookPayload', () => {
  it('builds the card from the Russian product titles, whatever language the order was in', () => {
    expect(buildOrderHookPayload(ORDER, PRODUCTS, ADMIN)).toEqual({
      orderId: 'order_1',
      displayId: 7,
      locale: 'sr',
      customer: {
        name: 'Marko Marković',
        phone: '+381601234567',
        email: 'kupac@example.com',
        channel: 'viber',
      },
      items: [
        {
          title: 'Bosch S4 024',
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
      adminUrl: 'https://api.carlab.rs/app/orders/order_1',
    });
  });

  it('falls back to the line title when the product is gone', () => {
    const payload = buildOrderHookPayload(ORDER, [], ADMIN);

    expect(payload.items.map((item) => item.title)).toEqual([
      'Bosch S4 024 (sr)',
      'Ugradnja akumulatora',
    ]);
    expect(payload.items.every((item) => !item.isService)).toBe(true);
  });

  it('leaves out a blank comment and channel', () => {
    const payload = buildOrderHookPayload(
      { ...ORDER, metadata: { comment: '  ', contact_channel: '' } },
      PRODUCTS,
      ADMIN,
    );

    expect(payload.comment).toBeUndefined();
    expect(payload.customer.channel).toBeUndefined();
  });

  it('refuses to build a card for an order without an international phone', () => {
    expect(() =>
      buildOrderHookPayload(
        {
          ...ORDER,
          shipping_address: { ...ORDER.shipping_address, phone: '0601234567' },
        },
        PRODUCTS,
        ADMIN,
      ),
    ).toThrow();
  });

  it('forwards neither comment nor channel when the metadata is malformed', () => {
    const payload = buildOrderHookPayload(
      { ...ORDER, metadata: { comment: 5, contact_channel: 'viber' } },
      PRODUCTS,
      ADMIN,
    );

    expect(payload.comment).toBeUndefined();
    expect(payload.customer.channel).toBeUndefined();
  });

  it('never forwards the honeypot field', () => {
    const payload = buildOrderHookPayload(ORDER, PRODUCTS, ADMIN);

    expect(JSON.stringify(payload)).not.toContain('website');
  });

  it('skips an empty line and keeps a line without a product', () => {
    const payload = buildOrderHookPayload(
      {
        ...ORDER,
        items: [
          null,
          {
            product_id: null,
            product_title: 'Ugradnja',
            quantity: 2,
            unit_price: '750',
          },
        ],
      },
      PRODUCTS,
      ADMIN,
    );

    expect(payload.items).toEqual([
      { title: 'Ugradnja', quantity: 2, unitPrice: 750, isService: false },
    ]);
  });

  it('clamps a title longer than the schema allows, so the card is still sent', () => {
    const longTitle = 'A'.repeat(400);
    const payload = buildOrderHookPayload(
      { ...ORDER, items: [ORDER.items![0]] },
      [{ id: 'prod_bat', title: longTitle }],
      ADMIN,
    );

    expect(payload.items[0].title).toHaveLength(ORDER_HOOK_LIMITS.title);
    expect(payload.items[0].title).toBe('A'.repeat(ORDER_HOOK_LIMITS.title));
  });

  it('refuses to build a card for an order without lines', () => {
    expect(() =>
      buildOrderHookPayload({ ...ORDER, items: null }, PRODUCTS, ADMIN),
    ).toThrow();
  });
});

describe('sendOrderHook', () => {
  const payload = buildOrderHookPayload(ORDER, PRODUCTS, ADMIN);

  it('posts exactly the bytes it signed', async () => {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const send = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 202, body: { cancel } });

    await sendOrderHook(
      payload,
      { url: HOOK_URL, secret: SECRET },
      send as never,
    );

    const [url, init] = send.mock.calls[0];
    expect(url).toBe(HOOK_URL);
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify(payload));
    expect(verifyHook(init.body, init.headers[ORDER_HOOK_HEADER], SECRET)).toBe(
      true,
    );
    expect(orderHookSchema.parse(JSON.parse(init.body))).toEqual(
      JSON.parse(init.body),
    );
    expect(cancel).toHaveBeenCalled();
  });

  it('throws on an answer that is not 2xx, so the event bus retries it', async () => {
    const send = jest.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(
      sendOrderHook(payload, { url: HOOK_URL, secret: SECRET }, send as never),
    ).rejects.toThrow('Order hook answered 500');
  });
});
