import { orderContactSchema } from '@podbor/lead-crm/shop-orders-wire';
import { describe, expect, it } from 'vitest';
import { MAX_COMMENT_LENGTH } from '@podbor/lead-crm/limits';
import {
  checkoutContactSchema,
  checkoutRefusalSchema,
  offerCartResponseSchema,
  identifierOffersResponseSchema,
  partOffersResponseSchema,
  orderCaseSummaryResponseSchema,
  placedOrderResponseSchema,
} from './cart.ts';
import { billedRows, cartFingerprint, cartTotals } from './fingerprint.ts';

const cart = {
  id: 'cart_1',
  completed: false,
  currency: 'RSD',
  total: 3700,
  items: [
    {
      id: 'item_1',
      offer_id: 'offer_1',
      quantity: 2,
      unit_price: 1850,
      available: true,
      in_stock: true,
      lead_time_days: 0,
      max_quantity: 4,
      addon: null,
      installation: null,
      part: {
        slug: 'bmw-11428575211',
        brand: 'BMW',
        number: '11 42 8575211',
        name: 'Oil filter',
      },
    },
  ],
};

describe('offerCartResponseSchema', () => {
  it('accepts a cart of offer lines', () => {
    expect(offerCartResponseSchema.parse({ cart })).toEqual({ cart });
  });

  it('accepts a line with an add-on service in the cart', () => {
    const items = [
      {
        ...cart.items[0],
        addon: {
          item_id: 'item_2',
          label: 'Регистрация аккумулятора',
          translations: { sr: { label: 'Registracija akumulatora' } },
          unit_price: 2500,
        },
      },
    ];
    expect(
      offerCartResponseSchema.parse({ cart: { ...cart, items } }).cart.items[0]
        .addon?.item_id,
    ).toBe('item_2');
  });

  it('accepts a line with installation at CarLab, free or priced', () => {
    const items = [
      { ...cart.items[0], installation: { item_id: 'item_3', unit_price: 0 } },
    ];
    expect(
      offerCartResponseSchema.parse({ cart: { ...cart, items } }).cart.items[0]
        .installation,
    ).toEqual({ item_id: 'item_3', unit_price: 0 });
  });

  it('reads a line from a shop that does not send the cap yet as uncapped', () => {
    const { max_quantity: _, ...line } = cart.items[0]!;
    expect(
      offerCartResponseSchema.parse({ cart: { ...cart, items: [line] } }).cart
        .items[0]?.max_quantity,
    ).toBeNull();
  });

  it('refuses a line without a quantity', () => {
    const items = [{ ...cart.items[0], quantity: 0 }];
    expect(
      offerCartResponseSchema.safeParse({ cart: { ...cart, items } }).success,
    ).toBe(false);
  });
});

describe('checkout answers', () => {
  it('reads a refusal code', () => {
    expect(checkoutRefusalSchema.parse({ code: 'OFFER_OUT_OF_STOCK' })).toEqual(
      { code: 'OFFER_OUT_OF_STOCK' },
    );
    expect(checkoutRefusalSchema.safeParse({ code: 'OTHER' }).success).toBe(
      false,
    );
  });

  it('reads a placed order and live offers', () => {
    expect(
      placedOrderResponseSchema.parse({
        order: { id: 'order_1', display_id: 7 },
      }).order.display_id,
    ).toBe(7);
    expect(partOffersResponseSchema.parse({ offers: [] })).toEqual({
      offers: [],
    });
    expect(
      identifierOffersResponseSchema.safeParse({ offers: { pi_1: [{}] } })
        .success,
    ).toBe(false);
  });

  it('carries what installing each part at CarLab costs, null where it is not offered', () => {
    expect(
      identifierOffersResponseSchema.parse({
        offers: {},
        installation: { pi_1: 0, pi_2: null },
      }).installation,
    ).toEqual({ pi_1: 0, pi_2: null });
    expect(
      identifierOffersResponseSchema.parse({ offers: {} }).installation,
    ).toEqual({});
  });
});

describe('checkoutContactSchema', () => {
  it('needs only a contact and drops blank optional fields', () => {
    expect(
      checkoutContactSchema.parse({
        contact: ' +381 64 1234567 ',
        contact_channel: 'whatsapp',
        name: '',
        vin: null,
        comment: '  ',
      }),
    ).toEqual({ contact: '+381641234567', contact_channel: 'whatsapp' });
  });

  it('keeps names on one line and drops bidi controls from every field', () => {
    expect(
      checkoutContactSchema.parse({
        contact: '+381 64 1234567\u202e',
        name: 'Ivan\nЗаказ оплачен \u202eevil',
        comment: 'a\u2066\nb',
      }),
    ).toEqual({
      contact: '+381641234567',
      name: 'Ivan Заказ оплачен evil',
      comment: 'a\nb',
    });
  });

  it('checks the contact the way the lead route does', () => {
    expect(
      checkoutContactSchema.safeParse({ contact: 'call me' }).success,
    ).toBe(false);
    expect(
      checkoutContactSchema.safeParse({
        contact: '@carlab_rs',
        contact_channel: 'telegram',
      }).success,
    ).toBe(true);
  });

  it('reads an unknown channel as none', () => {
    expect(
      checkoutContactSchema.parse({
        contact: '+381641234567',
        contact_channel: 'pigeon',
      }).contact_channel,
    ).toBeUndefined();
  });

  it('stores a VIN the way the VIN lookup keys it, and other text as typed', () => {
    expect(
      checkoutContactSchema.parse({
        contact: '+381641234567',
        vin: ' wba 35bg07-0n074158 ',
      }).vin,
    ).toBe('WBA35BG070N074158');
    expect(
      checkoutContactSchema.parse({ contact: '+381641234567', vin: 'wba35' })
        .vin,
    ).toBe('wba35');
  });

  it('carries the car and the locale', () => {
    expect(
      checkoutContactSchema.parse({
        contact: '+381641234567',
        car: 'BMW 3 F30 320d',
        locale: 'sr',
      }),
    ).toEqual({
      contact: '+381641234567',
      car: 'BMW 3 F30 320d',
      locale: 'sr',
    });
  });

  it('refuses a comment past the lead limit', () => {
    expect(
      checkoutContactSchema.safeParse({
        contact: '+381641234567',
        comment: 'x'.repeat(MAX_COMMENT_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('carries the visitor attribution under the lead form field names', () => {
    const attribution = {
      source_url: 'https://carlab.rs/ru/parts/cart/',
      visitor_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
      ad_source: '{"utm_source":"google"}',
      meta_ids: '{"fbp":"fb.1.1.1"}',
    };

    expect(
      checkoutContactSchema.parse({ contact: '+381641234567', ...attribution }),
    ).toEqual({ contact: '+381641234567', ...attribution });
  });

  it.each([
    { contact: ' +381 64 1234567 ', contact_channel: 'whatsapp' },
    {
      contact: '@carlab_rs',
      contact_channel: 'telegram',
      name: 'Ivan',
      vin: ' wba 35bg07-0n074158 ',
      car: 'BMW 3 F30 320d',
      comment: 'a\nb',
      locale: 'sr',
      source_url: 'https://carlab.rs/ru/parts/cart/',
      visitor_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
      ad_source: '{"utm_source":"google"}',
      meta_ids: '{"fbp":"fb.1.1.1"}',
    },
    { contact: '+381641234567', name: 'x'.repeat(MAX_COMMENT_LENGTH) },
  ])('hands the CRM a contact its order Lead takes as is (%#)', (typed) => {
    const contact = checkoutContactSchema.safeParse(typed);
    if (!contact.success) return;
    expect(orderContactSchema.parse(contact.data)).toEqual(contact.data);
  });

  it('drops an attribution field past its limit rather than refusing the order', () => {
    expect(
      checkoutContactSchema.parse({
        contact: '+381641234567',
        source_url: 'x'.repeat(5000),
      }),
    ).toEqual({ contact: '+381641234567' });
  });
});

describe('cartFingerprint', () => {
  const line = (id: string, quantity: number, unit_price: number) => ({
    id,
    quantity,
    unit_price,
  });

  it('ignores the order of the lines', () => {
    expect(cartFingerprint([line('b', 1, 100), line('a', 2, 50)])).toBe(
      cartFingerprint([line('a', 2, 50), line('b', 1, 100)]),
    );
  });

  it('changes when a line, a quantity or a price changes', () => {
    const shown = cartFingerprint([line('a', 2, 50), line('b', 1, 100)]);

    expect(cartFingerprint([line('a', 2, 50)])).not.toBe(shown);
    expect(cartFingerprint([line('a', 3, 50), line('b', 1, 100)])).not.toBe(
      shown,
    );
    expect(cartFingerprint([line('a', 2, 60), line('b', 1, 100)])).not.toBe(
      shown,
    );
  });

  it('reads an added add-on service as a line of its own, one per unit, as the stored cart holds it', () => {
    const nested = cartFingerprint([
      {
        ...line('a', 2, 50),
        addon: { item_id: 'b', unit_price: 2500 },
      },
    ]);

    expect(nested).toBe(
      cartFingerprint([line('a', 2, 50), line('b', 2, 2500)]),
    );
    expect(
      cartFingerprint([
        { ...line('a', 2, 50), addon: { item_id: null, unit_price: 2500 } },
      ]),
    ).toBe(cartFingerprint([line('a', 2, 50)]));
  });

  it('reads an added installation as a line of its own beside the add-on service', () => {
    expect(
      cartFingerprint([
        {
          ...line('a', 2, 50),
          addon: { item_id: 'b', unit_price: 2500 },
          installation: { item_id: 'c', unit_price: 0 },
        },
      ]),
    ).toBe(
      cartFingerprint([line('a', 2, 50), line('b', 2, 2500), line('c', 2, 0)]),
    );
    expect(
      cartFingerprint([
        { ...line('a', 2, 50), installation: { item_id: null, unit_price: 0 } },
      ]),
    ).toBe(cartFingerprint([line('a', 2, 50)]));
  });
});

describe('orderCaseSummaryResponseSchema', () => {
  it('reads the car, the Parts and the RSD total of a completed Order', () => {
    expect(
      orderCaseSummaryResponseSchema.parse({
        summary: {
          display_id: 7,
          car: { make: 'BMW', model: '3 серия F30 320d', year: 2016 },
          parts: [{ brand: 'MANN-FILTER', number: 'HU 816 x' }],
          total_rsd: 3700,
          vin: 'WBA8E9G50GNT12345',
        },
      }),
    ).toEqual({
      summary: {
        display_id: 7,
        car: { make: 'BMW', model: '3 серия F30 320d', year: 2016 },
        parts: [{ brand: 'MANN-FILTER', number: 'HU 816 x' }],
        total_rsd: 3700,
      },
    });
  });

  it('reads a shop that sends no car and no total yet', () => {
    expect(
      orderCaseSummaryResponseSchema.parse({
        summary: { display_id: 7, parts: [] },
      }).summary,
    ).toEqual({ display_id: 7, car: null, parts: [], total_rsd: null });
  });
});

describe('billedRows', () => {
  it('bills an added service and installation per unit of their line', () => {
    expect(
      billedRows([
        {
          id: 'a',
          quantity: 2,
          unit_price: 50,
          addon: { item_id: 'b', unit_price: 2500 },
          installation: { item_id: 'c', unit_price: 0 },
        },
        {
          id: 'd',
          quantity: 1,
          unit_price: 70,
          addon: { item_id: null, unit_price: 2500 },
        },
      ]),
    ).toEqual([
      { id: 'a', quantity: 2, unit_price: 50, kind: 'part' },
      { id: 'b', quantity: 2, unit_price: 2500, kind: 'service' },
      { id: 'c', quantity: 2, unit_price: 0, kind: 'installation' },
      { id: 'd', quantity: 1, unit_price: 70, kind: 'part' },
    ]);
  });
});

describe('cartTotals', () => {
  it('sums the parts and the added services of the lines that can be sold', () => {
    expect(
      cartTotals([
        {
          id: 'a',
          quantity: 2,
          unit_price: 50,
          available: true,
          addon: { item_id: 'b', unit_price: 2500 },
          installation: { item_id: 'c', unit_price: 300 },
        },
        { id: 'd', quantity: 3, unit_price: 70, available: false },
      ]),
    ).toEqual({ count: 2, parts: 100, addons: 5600, total: 5700 });
  });

  it('totals an empty cart at zero', () => {
    expect(cartTotals([])).toEqual({
      count: 0,
      parts: 0,
      addons: 0,
      total: 0,
    });
  });
});
