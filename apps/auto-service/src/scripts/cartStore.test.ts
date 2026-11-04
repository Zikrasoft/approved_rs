import { describe, expect, it } from 'vitest';
import {
  settleCart,
  forgetCart,
  forgetOrderedCart,
  orderedNumber,
  unavailableNames,
  moveCartToInquiry,
  readCart,
  readReceipt,
  rememberCart,
  rememberReceipt,
  priceChanges,
  orderLines,
} from './cartStore';
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
      in_stock: true,
      lead_time_days: 0,
      max_quantity: null,
      addon: null,
      installation: null,
      part: bmwOil,
    },
  ],
};

const SERVICE = {
  label: 'Регистрация аккумулятора',
  translations: null,
  unit_price: 2500,
};

describe('the cart lines a failed checkout keeps', () => {
  it('prices every line and add-on as the order Lead does, with the total', () => {
    expect(
      orderLines({
        ...cart,
        total: 9600,
        items: [
          {
            ...cart.items[0]!,
            quantity: 2,
            in_stock: false,
            lead_time_days: 1,
            addon: { ...SERVICE, item_id: 'item_2' },
            installation: { item_id: 'item_3', unit_price: 0 },
          },
          {
            ...cart.items[0]!,
            id: 'item_4',
            addon: { ...SERVICE, item_id: null },
          },
        ],
      }).split('\n'),
    ).toEqual([
      'Масляный фильтр (BMW 11 42 8575211) × 2: 3 700 RSD, забрать завтра',
      '+ Регистрация аккумулятора: 5 000 RSD',
      '+ Установка в сервисе CarLab: бесплатно',
      'Масляный фильтр (BMW 11 42 8575211) × 1: 1 850 RSD, в наличии',
      'Итого: 9 600 RSD',
    ]);
  });
});

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

describe('the order number in the link', () => {
  it('keeps a plain number, so a reload still confirms the order', () => {
    expect(orderedNumber('ordered', '23')).toBe('23');
  });

  it('drops anything else', () => {
    expect(orderedNumber('ordered', '23<b>')).toBeNull();
    expect(orderedNumber('ordered', null)).toBeNull();
    expect(orderedNumber('expired', '23')).toBeNull();
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

  it('names each line whose price moved since the visitor last saw the cart', () => {
    const storage = memoryStorage();
    rememberCart(cart, storage);
    const seen = readCart(storage)!;
    const repriced = {
      ...cart,
      items: [{ ...cart.items[0], unit_price: 1990 }],
    };

    expect(priceChanges(seen, cart)).toEqual([]);
    expect(priceChanges(seen, repriced)).toEqual([
      { name: 'Масляный фильтр', before: 1850, after: 1990 },
    ]);
    expect(priceChanges({ id: 'cart_1', parts: [bmwOil] }, repriced)).toEqual(
      [],
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

  it('works without a cart when storage is blocked', () => {
    rememberCart(cart, blockedStorage);
    forgetCart(blockedStorage);

    expect(readCart(blockedStorage)).toBeNull();
  });
});
