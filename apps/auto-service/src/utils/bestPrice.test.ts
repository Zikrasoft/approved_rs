import { describe, expect, it } from 'vitest';
import { bestPrice } from './bestPrice';

const offer = (price: number, stock_quantity: number, lead_time_days = 0) => ({
  id: `offer_${price}`,
  price,
  currency: 'RSD',
  stock_quantity,
  lead_time_days,
});

describe('bestPrice', () => {
  it('gives the lowest price the visitor can buy now across every number of a part', () => {
    expect(
      bestPrice([
        { offers: [offer(1700, 0)] },
        { offers: [offer(2400, 3), offer(1850, 2)] },
      ]),
    ).toEqual({
      price: 1850,
      currency: 'RSD',
      inStock: true,
      buyable: true,
      leadDays: 0,
    });
  });

  it('falls back to the lowest price and its pickup time when nothing is in stock', () => {
    expect(
      bestPrice([{ offers: [offer(2200, 0, 2), offer(1700, 0, 4)] }]),
    ).toEqual({
      price: 1700,
      currency: 'RSD',
      inStock: false,
      buyable: true,
      leadDays: 4,
    });
  });

  it('shows an offer the supplier brings in over a cheaper one nobody can sell', () => {
    expect(
      bestPrice([{ offers: [offer(1200, 0, 0), offer(1700, 0, 4)] }]),
    ).toMatchObject({ price: 1700, buyable: true, leadDays: 4 });
  });

  it('shows the lowest price when no offer can be bought', () => {
    expect(
      bestPrice([{ offers: [offer(2200, 0), offer(1700, 0)] }]),
    ).toMatchObject({ price: 1700, inStock: false, buyable: false });
  });

  it('has nothing to show for a part priced on request', () => {
    expect(bestPrice([{ offers: [] }])).toBeNull();
  });
});
