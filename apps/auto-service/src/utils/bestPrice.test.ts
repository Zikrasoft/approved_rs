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
      id: 'offer_1850',
      price: 1850,
      currency: 'RSD',
      startsFrom: false,
      inStock: true,
      buyable: true,
      leadDays: 0,
    });
  });

  it('falls back to the lowest price and its pickup time when nothing is in stock', () => {
    expect(
      bestPrice([{ offers: [offer(2200, 0, 2), offer(1700, 0, 4)] }]),
    ).toEqual({
      id: 'offer_1700',
      price: 1700,
      currency: 'RSD',
      startsFrom: true,
      inStock: false,
      buyable: true,
      leadDays: 4,
    });
  });

  it('shows the lowest price when no offer can be bought', () => {
    expect(
      bestPrice([{ offers: [offer(2200, 0), offer(1700, 0)] }]),
    ).toMatchObject({ price: 1700, inStock: false, buyable: false });
  });

  it('starts from the shown price only when no offer costs less', () => {
    expect(
      bestPrice([{ offers: [offer(1200, 4), offer(1500, 0, 2)] }]),
    ).toMatchObject({ price: 1200, startsFrom: true });
    expect(bestPrice([{ offers: [offer(1200, 4)] }])).toMatchObject({
      startsFrom: false,
    });
  });

  it('has nothing to show for a part priced on request', () => {
    expect(bestPrice([{ offers: [] }])).toBeNull();
  });
});
