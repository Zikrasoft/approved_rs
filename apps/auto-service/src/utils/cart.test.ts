import { describe, it, expect } from 'vitest';
import {
  addLine,
  cartCount,
  cartTotal,
  describeCart,
  MAX_LINE_QUANTITY,
  parseCart,
  removeLine,
  setQuantity,
  type CartLine,
} from './cart';

const line = (over: Partial<CartLine> = {}): CartLine => ({
  slug: 'battery-60',
  title: 'Battery 60Ah',
  price: 90,
  quantity: 1,
  ...over,
});

describe('parseCart', () => {
  it('returns an empty cart for missing storage', () => {
    expect(parseCart(null)).toEqual([]);
  });

  it('returns an empty cart for malformed JSON rather than throwing', () => {
    expect(parseCart('{not json')).toEqual([]);
  });

  it('returns an empty cart when the stored value is not a list', () => {
    expect(parseCart('{"slug":"x"}')).toEqual([]);
  });

  it('drops entries missing a slug, title or price', () => {
    const raw = JSON.stringify([
      { slug: '', title: 'x', price: 1, quantity: 1 },
      { slug: 'a', price: 1, quantity: 1 },
      { slug: 'b', title: 'x', quantity: 1 },
      line(),
    ]);
    expect(parseCart(raw)).toEqual([line()]);
  });

  it('drops a line with a non-numeric or zero quantity', () => {
    const raw = JSON.stringify([
      { ...line(), quantity: 0 },
      { ...line(), quantity: 'many' },
    ]);
    expect(parseCart(raw)).toEqual([]);
  });

  it('clamps a tampered quantity to the maximum', () => {
    const raw = JSON.stringify([{ ...line(), quantity: 9999 }]);
    expect(parseCart(raw)[0].quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('rejects a non-finite price', () => {
    const raw = '[{"slug":"a","title":"x","price":null,"quantity":1}]';
    expect(parseCart(raw)).toEqual([]);
  });

  it('rejects a tampered negative price rather than billing it', () => {
    const raw = JSON.stringify([{ ...line(), price: -500 }]);
    expect(parseCart(raw)).toEqual([]);
  });
});

describe('addLine', () => {
  it('appends a new product with quantity one', () => {
    expect(addLine([], { slug: 'a', title: 'A', price: 10 })).toEqual([
      { slug: 'a', title: 'A', price: 10, quantity: 1 },
    ]);
  });

  it('increments an existing line instead of duplicating it', () => {
    const cart = addLine([line()], {
      slug: 'battery-60',
      title: 'x',
      price: 1,
    });
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(2);
  });

  it('never pushes a line past the maximum quantity', () => {
    const cart = addLine([line({ quantity: MAX_LINE_QUANTITY })], {
      slug: 'battery-60',
      title: 'x',
      price: 1,
    });
    expect(cart[0].quantity).toBe(MAX_LINE_QUANTITY);
  });
});

describe('setQuantity', () => {
  it('updates one line', () => {
    expect(setQuantity([line()], 'battery-60', 3)[0].quantity).toBe(3);
  });

  it('clamps an emptied field to one instead of deleting the line', () => {
    expect(
      setQuantity([line({ quantity: 3 })], 'battery-60', 0)[0].quantity,
    ).toBe(1);
  });

  it('clamps a negative quantity to one', () => {
    expect(setQuantity([line()], 'battery-60', -5)[0].quantity).toBe(1);
  });

  it('leaves the cart untouched for a non-numeric quantity', () => {
    const cart = [line()];
    expect(setQuantity(cart, 'battery-60', Number.NaN)).toEqual(cart);
  });

  it('clamps to the maximum', () => {
    expect(setQuantity([line()], 'battery-60', 999)[0].quantity).toBe(
      MAX_LINE_QUANTITY,
    );
  });

  it('leaves other lines untouched', () => {
    const cart = [line(), line({ slug: 'other' })];
    expect(setQuantity(cart, 'battery-60', 5)[1]).toEqual(cart[1]);
  });
});

describe('removeLine', () => {
  it('drops the matching line only', () => {
    const cart = [line(), line({ slug: 'other' })];
    expect(removeLine(cart, 'battery-60')).toEqual([cart[1]]);
  });
});

describe('totals', () => {
  it('counts every unit, not every line', () => {
    expect(cartCount([line({ quantity: 2 }), line({ slug: 'b' })])).toBe(3);
  });

  it('multiplies price by quantity', () => {
    expect(
      cartTotal([line({ quantity: 2 }), line({ slug: 'b', price: 30 })]),
    ).toBe(210);
  });

  it('describes the order one line per row for the operator', () => {
    expect(describeCart([line({ quantity: 2 })])).toBe(
      'Battery 60Ah × 2 — 180 €',
    );
  });
});
