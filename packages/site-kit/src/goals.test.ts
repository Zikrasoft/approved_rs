import { describe, it, expect } from 'vitest';
import { GOALS } from './goals.ts';

describe('GOALS', () => {
  it('names the shop funnel', () => {
    expect(GOALS.addToCart).toBe('add_to_cart');
    expect(GOALS.beginCheckout).toBe('begin_checkout');
    expect(GOALS.orderPlaced).toBe('order_placed');
  });

  it('uses unique snake_case identifiers, the form Metrika goals are created with', () => {
    const ids = Object.values(GOALS);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
  });
});
