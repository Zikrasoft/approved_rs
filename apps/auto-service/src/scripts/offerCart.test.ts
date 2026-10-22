import { describe, expect, it } from 'vitest';
import {
  settleCart,
  forgetCart,
  forgetOrderedCart,
  unavailableNames,
  moveCartToInquiry,
  orderSummary,
  readCart,
  readReceipt,
  rememberCart,
  rememberReceipt,
  repricedSince,
} from './offerCart';
import { cartCount } from './cartBadge';
import { readPartsList } from './partsList';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

const blockedStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const bmwOil = {
  slug: 'bmw-11428575211',
  brand: 'BMW',
  number: '11 42 8575211',
  name: 'Масляный фильтр',
};

const cart = {
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
      addon: null,
      part: bmwOil,
    },
  ],
};

const SERVICE = {
  label: 'Регистрация аккумулятора',
  translations: null,
  unit_price: 2500,
};

describe('the order receipt', () => {
  it('comes back only for the cart that became the order', () => {
    const storage = memoryStorage();
    rememberReceipt(cart, storage);

    expect(readReceipt('cart_1', storage)).toMatchObject({ id: 'cart_1' });
    expect(readReceipt('cart_0', storage)).toBeNull();
    expect(readReceipt(null, memoryStorage())).toBeNull();
  });

  it('is skipped when storage is blocked', () => {
    rememberReceipt(cart, blockedStorage);

    expect(readReceipt('cart_1', blockedStorage)).toBeNull();
  });
});

describe('the remembered cart', () => {
  it('keeps the cart id and its parts for the next page load', () => {
    const storage = memoryStorage();

    rememberCart(cart, storage);

    expect(readCart(storage)).toMatchObject({ id: 'cart_1', parts: [bmwOil] });
    forgetCart(storage);
    expect(readCart(storage)).toBeNull();
  });

  it('forgets the cart once it became an order', () => {
    const storage = memoryStorage();
    rememberCart(cart, storage);

    forgetOrderedCart('cart_1', storage);

    expect(readCart(storage)).toBeNull();
  });

  it('keeps a newer cart when an old order confirmation is opened again', () => {
    const storage = memoryStorage();
    rememberCart(cart, storage);

    forgetOrderedCart('cart_0', storage);
    forgetOrderedCart(null, storage);

    expect(readCart(storage)).toMatchObject({ id: 'cart_1' });
  });

  it('names the lines that keep the cart from being ordered', () => {
    expect(
      unavailableNames({
        ...cart,
        items: [
          ...cart.items,
          { ...cart.items[0], id: 'item_2', available: false },
        ],
      }),
    ).toEqual(['Масляный фильтр']);
    expect(unavailableNames(cart)).toEqual([]);
  });

  it('moves the parts into the inquiry list when the shop is down', () => {
    const storage = memoryStorage();
    rememberCart(cart, storage);

    moveCartToInquiry(storage);

    expect(readPartsList(storage)).toEqual([{ ...bmwOil, quantity: 1 }]);
    expect(readCart(storage)).toBeNull();
  });

  it('carries the add-on service of a line into the inquiry', () => {
    const storage = memoryStorage();
    rememberCart(
      {
        ...cart,
        items: [
          { ...cart.items[0], addon: { ...SERVICE, item_id: 'item_2' } },
          {
            ...cart.items[0],
            id: 'item_3',
            part: { ...bmwOil, slug: 'other' },
            addon: {
              ...SERVICE,
              translations: { sr: { label: 'Registracija akumulatora' } },
              item_id: null,
            },
          },
        ],
      },
      storage,
    );

    moveCartToInquiry(storage);

    expect(readPartsList(storage)).toEqual([
      {
        ...bmwOil,
        quantity: 1,
        addon: SERVICE.label,
        addon_price: 2500,
        with_addon: true,
      },
      {
        ...bmwOil,
        slug: 'other',
        quantity: 1,
        addon: SERVICE.label,
        addon_translations: { sr: { label: 'Registracija akumulatora' } },
        addon_price: 2500,
        with_addon: false,
      },
    ]);
  });

  it('carries each line quantity into the inquiry', () => {
    const storage = memoryStorage();
    rememberCart(
      { ...cart, items: [{ ...cart.items[0], quantity: 3 }] },
      storage,
    );

    moveCartToInquiry(storage);

    expect(readPartsList(storage)).toEqual([{ ...bmwOil, quantity: 3 }]);
  });

  it.each([
    [{ kind: 'cart', cart } as const, 'cart'],
    [{ kind: 'empty' } as const, 'gone'],
    [
      { kind: 'refused', code: 'OFFER_OUT_OF_STOCK', cartId: null } as const,
      'refused',
    ],
    [{ kind: 'inquiry' } as const, 'unreachable'],
    [null, 'unreachable'],
  ])('reads %j as %s', (outcome, state) => {
    expect(settleCart(outcome, memoryStorage())).toBe(state);
  });

  it('keeps the cart while the shop cannot be reached', () => {
    const storage = memoryStorage();
    rememberCart(cart, storage);

    settleCart(null, storage);
    expect(readCart(storage)).toMatchObject({ id: 'cart_1' });

    settleCart({ kind: 'empty' }, storage);
    expect(readCart(storage)).toBeNull();
  });

  it('notices a price that moved since the visitor last saw the cart', () => {
    const storage = memoryStorage();
    rememberCart(cart, storage);
    const seen = readCart(storage)!;
    const repriced = {
      ...cart,
      items: [{ ...cart.items[0], unit_price: 1990 }],
    };

    expect(repricedSince(seen, cart)).toBe(false);
    expect(repricedSince(seen, repriced)).toBe(true);
    expect(repricedSince({ id: 'cart_1', parts: [bmwOil] }, repriced)).toBe(
      false,
    );
  });

  it('counts the parts in the cart for the header', () => {
    const storage = memoryStorage();
    expect(cartCount(storage)).toBe(0);

    rememberCart(
      { ...cart, items: [{ ...cart.items[0], quantity: 3 }] },
      storage,
    );

    expect(cartCount(storage)).toBe(3);
    expect(cartCount(blockedStorage)).toBe(0);
  });

  it('sums only the lines that can still be sold', () => {
    expect(
      orderSummary({
        ...cart,
        items: [
          { ...cart.items[0], quantity: 2 },
          { ...cart.items[0], id: 'item_2', unit_price: 999, available: false },
        ],
      }),
    ).toEqual({ count: 2, parts: 3700, addons: 0, total: 3700 });
  });

  it('adds the add-on service a sellable line carries', () => {
    expect(
      orderSummary({
        ...cart,
        items: [
          { ...cart.items[0], addon: { ...SERVICE, item_id: 'item_2' } },
          {
            ...cart.items[0],
            id: 'item_3',
            addon: { ...SERVICE, item_id: null },
          },
          {
            ...cart.items[0],
            id: 'item_4',
            available: false,
            addon: { ...SERVICE, item_id: 'item_5' },
          },
        ],
      }),
    ).toEqual({
      count: 2,
      parts: 1850 + 1850,
      addons: 2500,
      total: 1850 + 2500 + 1850,
    });
  });

  it('works without a cart when storage is blocked', () => {
    rememberCart(cart, blockedStorage);
    forgetCart(blockedStorage);

    expect(readCart(blockedStorage)).toBeNull();
  });
});
