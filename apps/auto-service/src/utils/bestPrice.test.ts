import { describe, expect, it } from 'vitest';
import { bestPrice } from './bestPrice';

const offer = (price: number, stock_quantity: number) => ({
  id: `offer_${price}`,
  price,
  currency: 'RSD',
  stock_quantity,
  lead_time_days: 0,
});

describe('bestPrice', () => {
  it('gives the lowest price the visitor can buy now across every number of a part', () => {
    expect(
      bestPrice([
        { offers: [offer(1700, 0)] },
        { offers: [offer(2400, 3), offer(1850, 2)] },
      ]),
    ).toEqual({ price: 1850, currency: 'RSD', inStock: true });
  });

  it('falls back to the lowest price on order when nothing is in stock', () => {
    expect(bestPrice([{ offers: [offer(2200, 0), offer(1700, 0)] }])).toEqual({
      price: 1700,
      currency: 'RSD',
      inStock: false,
    });
  });

  it('has nothing to show for a part priced on request', () => {
    expect(bestPrice([{ offers: [] }])).toBeNull();
  });
});
