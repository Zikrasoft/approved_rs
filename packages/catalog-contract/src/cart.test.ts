import { describe, expect, it } from 'vitest';
import {
  checkoutRefusalSchema,
  offerCartResponseSchema,
  partOffersResponseSchema,
  placedOrderResponseSchema,
} from './cart.ts';

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
  });
});
