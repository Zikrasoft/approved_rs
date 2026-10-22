import { describe, expect, it } from 'vitest';
import { isBuyable, orderCap } from './availability.ts';

describe('offer availability', () => {
  it('caps an in-stock offer at its stock', () => {
    expect(orderCap({ stock_quantity: 3, lead_time_days: 4 })).toBe(3);
  });

  it('caps a lead-time offer without stock at ten', () => {
    expect(orderCap({ stock_quantity: 0, lead_time_days: 4 })).toBe(10);
  });

  it('sells nothing from an offer without stock or lead time', () => {
    expect(orderCap({ stock_quantity: 0, lead_time_days: 0 })).toBe(0);
    expect(isBuyable({ stock_quantity: 0, lead_time_days: 0 })).toBe(false);
  });

  it('sells an offer with stock or a lead time', () => {
    expect(isBuyable({ stock_quantity: 2, lead_time_days: 0 })).toBe(true);
    expect(isBuyable({ stock_quantity: 0, lead_time_days: 4 })).toBe(true);
  });
});
