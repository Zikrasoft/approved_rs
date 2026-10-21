import { sellPrice, storeOffers } from '../pricing';

describe('sellPrice', () => {
  it('applies the markup percentage and rounds to the nearest unit', () => {
    expect(sellPrice(1542, 20)).toBe(1850);
  });

  it('returns the cost price unchanged at a zero markup', () => {
    expect(sellPrice(1000, 0)).toBe(1000);
  });
});

describe('storeOffers', () => {
  const offer = (
    id: string,
    cost_price: number,
    stock_quantity: number,
    lead_time_days: number,
  ) => ({
    id,
    cost_price,
    currency: 'RSD',
    stock_quantity,
    lead_time_days,
    supplier_article_id: `art-${id}`,
    supplier: { name: 'Intercars', markup_percentage: 10 },
  });

  it('puts the lowest price in stock first, then the shorter lead time, then what is out of stock', () => {
    expect(
      storeOffers([
        offer('cheap-but-out', 500, 0, 0),
        offer('slow', 1000, 3, 5),
        offer('dear', 2000, 9, 0),
        offer('fast', 1000, 1, 1),
      ]),
    ).toEqual([
      {
        id: 'fast',
        price: 1100,
        currency: 'RSD',
        stock_quantity: 1,
        lead_time_days: 1,
      },
      {
        id: 'slow',
        price: 1100,
        currency: 'RSD',
        stock_quantity: 3,
        lead_time_days: 5,
      },
      {
        id: 'dear',
        price: 2200,
        currency: 'RSD',
        stock_quantity: 9,
        lead_time_days: 0,
      },
      {
        id: 'cheap-but-out',
        price: 550,
        currency: 'RSD',
        stock_quantity: 0,
        lead_time_days: 0,
      },
    ]);
  });
});
