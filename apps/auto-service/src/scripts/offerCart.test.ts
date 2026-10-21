import { describe, expect, it } from 'vitest';
import {
  forgetCart,
  moveCartToInquiry,
  readCart,
  rememberCart,
} from './offerCart';
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
      part: bmwOil,
    },
  ],
};

describe('the remembered cart', () => {
  it('keeps the cart id and its parts for the next page load', () => {
    const storage = memoryStorage();

    rememberCart(cart, storage);

    expect(readCart(storage)).toEqual({ id: 'cart_1', parts: [bmwOil] });
    forgetCart(storage);
    expect(readCart(storage)).toBeNull();
  });

  it('moves the parts into the inquiry list when the shop is down', () => {
    const storage = memoryStorage();
    rememberCart(cart, storage);

    moveCartToInquiry(storage);

    expect(readPartsList(storage)).toEqual([bmwOil]);
  });

  it('works without a cart when storage is blocked', () => {
    rememberCart(cart, blockedStorage);
    forgetCart(blockedStorage);

    expect(readCart(blockedStorage)).toBeNull();
  });
});
