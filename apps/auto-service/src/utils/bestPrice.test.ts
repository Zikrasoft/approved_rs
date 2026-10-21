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
  it('gives the lowest price across every number of a part and whether any is in stock', () => {
    expect(
      bestPrice([
        { offers: [offer(2200, 0)] },
        { offers: [offer(1850, 0), offer(2400, 3)] },
      ]),
    ).toEqual({ price: 1850, currency: 'RSD', inStock: true });
  });

  it('has nothing to show for a part priced on request', () => {
    expect(bestPrice([{ offers: [] }])).toBeNull();
  });
});
