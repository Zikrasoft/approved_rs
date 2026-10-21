import { describe, expect, it, vi } from 'vitest';
import { createCatalogue } from './catalogue';

const CART = {
  id: 'cart_1',
  completed: false,
  currency: 'RSD',
  total: 1850,
  items: [
    {
      id: 'item_1',
      offer_id: 'offer_1',
      quantity: 1,
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

const OFFERS = [
  {
    id: 'offer_1',
    price: 1850,
    currency: 'RSD',
    stock_quantity: 4,
    lead_time_days: 0,
  },
];

const status = (code: number, body: unknown = {}) =>
  Promise.resolve({ ok: code < 400, status: code, json: async () => body });

const answer = (body: unknown) => vi.fn(() => status(200, body));

const unreachable = () =>
  vi.fn().mockRejectedValue(new TypeError('fetch failed'));

const catalog = (fetch: ReturnType<typeof vi.fn>) =>
  createCatalogue({
    backendUrl: 'http://shop.test',
    publishableKey: 'pk_test',
    timeoutMs: 50,
    fetch: fetch as unknown as typeof globalThis.fetch,
  });

describe('catalogue.liveOffers', () => {
  it('refreshes the offers of a brand-number', async () => {
    const fetch = answer({ offers: OFFERS });

    expect(await catalog(fetch).liveOffers('pi_bmw')).toEqual({
      kind: 'offers',
      offers: OFFERS,
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/part-identifiers/pi_bmw/offers',
      expect.anything(),
    );
  });

  it.each([
    ['a non-ok answer', () => vi.fn(() => status(503))],
    [
      'a body that breaks the contract',
      () => answer({ offers: [{ id: 'x' }] }),
    ],
    ['an unreachable backend', unreachable],
  ])('falls back to the inquiry on %s', async (_, fetch) => {
    expect(await catalog(fetch()).liveOffers('pi_bmw')).toEqual({
      kind: 'inquiry',
    });
  });
});

describe('catalogue.addToCart', () => {
  it('opens a cart for the first offer', async () => {
    const fetch = vi.fn((url: string) =>
      status(200, {
        cart: url.endsWith('/items') ? CART : { ...CART, items: [], total: 0 },
      }),
    );

    expect(await catalog(fetch).addToCart(null, 'offer_1')).toEqual({
      kind: 'cart',
      cart: CART,
    });
    expect(fetch).toHaveBeenLastCalledWith(
      'http://shop.test/store/offer-carts/cart_1/items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ offer_id: 'offer_1', quantity: 1 }),
      }),
    );
  });

  it('opens a fresh cart when the remembered one is gone', async () => {
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => status(404))
      .mockImplementationOnce(() =>
        status(200, { cart: { ...CART, items: [], total: 0 } }),
      )
      .mockImplementationOnce(() => status(200, { cart: CART }));

    expect(await catalog(fetch).addToCart('cart_old', 'offer_1')).toEqual({
      kind: 'cart',
      cart: CART,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([
    [
      'an offer the supplier cannot sell now',
      () => vi.fn(() => status(400, { code: 'OFFER_OUT_OF_STOCK' })),
    ],
    ['an unreachable backend', unreachable],
  ])('falls back to the inquiry on %s', async (_, fetch) => {
    expect(await catalog(fetch()).addToCart('cart_1', 'offer_1')).toEqual({
      kind: 'inquiry',
    });
  });
});

describe('catalogue.viewCart', () => {
  it('re-quotes the cart live', async () => {
    const fetch = answer({ cart: CART });

    expect(await catalog(fetch).viewCart('cart_1')).toEqual({
      kind: 'cart',
      cart: CART,
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/offer-carts/cart_1/reprice',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it.each([
    ['a cart that is gone', () => vi.fn(() => status(404))],
    [
      'a cart already placed as an order',
      () => answer({ cart: { ...CART, completed: true, items: [] } }),
    ],
  ])('shows an empty cart for %s', async (_, fetch) => {
    expect(await catalog(fetch()).viewCart('cart_1')).toEqual({
      kind: 'empty',
    });
  });

  it('falls back to the inquiry when the backend is down', async () => {
    expect(await catalog(unreachable()).viewCart('cart_1')).toEqual({
      kind: 'inquiry',
    });
  });
});

describe('catalogue.removeFromCart', () => {
  it('removes a line', async () => {
    const fetch = answer({ cart: { ...CART, items: [], total: 0 } });

    expect(await catalog(fetch).removeFromCart('cart_1', 'item_1')).toEqual({
      kind: 'empty',
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/offer-carts/cart_1/items/item_1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('catalogue.placeOrder', () => {
  const contact = {
    contact: '+381601234567',
    contact_channel: 'whatsapp' as const,
  };

  it('places the order with the contact', async () => {
    const fetch = answer({ order: { id: 'order_1', display_id: 7 } });

    expect(await catalog(fetch).placeOrder('cart_1', contact)).toEqual({
      kind: 'order',
      order: { id: 'order_1', display_id: 7 },
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://shop.test/store/offer-carts/cart_1/complete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(contact),
      }),
    );
  });

  it('passes on why checkout refused the cart', async () => {
    const fetch = vi.fn(() => status(400, { code: 'OFFER_PRICE_CHANGED' }));

    expect(await catalog(fetch).placeOrder('cart_1', contact)).toEqual({
      kind: 'refused',
      code: 'OFFER_PRICE_CHANGED',
    });
  });

  it.each([
    ['an unexplained error', () => vi.fn(() => status(500))],
    ['an unreachable backend', unreachable],
  ])('falls back to the inquiry on %s', async (_, fetch) => {
    expect(await catalog(fetch()).placeOrder('cart_1', contact)).toEqual({
      kind: 'inquiry',
    });
  });
});
