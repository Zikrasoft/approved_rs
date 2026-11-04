import {
  isSellable,
  offersByIdentifier,
  sellPrice,
  storeOffer,
  storeOffers,
} from '../pricing';

describe('sellPrice', () => {
  it('applies the markup percentage and rounds to the nearest unit', () => {
    expect(sellPrice(1542, 20)).toBe(1850);
  });

  it('applies a decimal markup', () => {
    expect(sellPrice(1000, 12.5)).toBe(1125);
  });

  it('returns the cost price unchanged at a zero markup', () => {
    expect(sellPrice(1000, 0)).toBe(1000);
  });

  it.each([
    [60, 2.5, 62],
    [100, 0.5, 101],
    [900, 12.5, 1013],
    [10.1, 15, 12],
    [33.3, 50, 50],
  ])(
    'rounds a half up exactly: %d at %d%% sells for %d',
    (cost, markup, price) => {
      expect(sellPrice(cost, markup)).toBe(price);
    },
  );
});

describe('storeOffers', () => {
  const offer = (
    id: string,
    cost_price: number,
    stock_quantity: number,
    lead_time_days: number,
    currency = 'RSD',
  ) => ({
    id,
    cost_price,
    currency,
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

  it('puts a back order before a cheaper offer nobody can buy', () => {
    expect(
      storeOffers([
        offer('cheap-but-gone', 500, 0, 0),
        offer('back-order', 1000, 0, 4),
      ]).map(({ id }) => id),
    ).toEqual(['back-order', 'cheap-but-gone']);
  });

  it('leaves out an offer in another currency than the shop sells in', () => {
    expect(
      storeOffers([
        offer('euro', 10, 5, 0, 'EUR'),
        offer('dinar', 1000, 1, 0),
      ]).map(({ id }) => id),
    ).toEqual(['dinar']);
  });

  it('leaves out an offer that would sell for nothing', () => {
    expect(
      storeOffers([offer('free', 0.4, 5, 0), offer('paid', 1000, 1, 0)]).map(
        ({ id }) => id,
      ),
    ).toEqual(['paid']);
  });
});

describe('isSellable', () => {
  const row = (cost_price: number, currency = 'RSD') => ({
    cost_price,
    currency,
    supplier: { markup_percentage: 20 },
  });

  it('sells a priced row in the shop currency only', () => {
    expect(isSellable(row(1542))).toBe(true);
    expect(isSellable(row(1542, 'eur'))).toBe(false);
    expect(isSellable(row(0.1))).toBe(false);
  });
});

describe('one priced offer', () => {
  const row = (part_identifier_id: string, id: string, currency = 'RSD') => ({
    id,
    part_identifier_id,
    cost_price: 1000,
    currency,
    stock_quantity: 2,
    lead_time_days: 1,
    supplier: { markup_percentage: 10 },
  });

  it('prices a sellable row and refuses one in another currency', () => {
    expect(storeOffer(row('pi_1', 'o1'))).toEqual({
      id: 'o1',
      price: 1100,
      currency: 'RSD',
      stock_quantity: 2,
      lead_time_days: 1,
    });
    expect(storeOffer(row('pi_1', 'o2', 'EUR'))).toBeNull();
  });

  it('groups the sellable offers by number in one pass', () => {
    const grouped = offersByIdentifier([
      row('pi_1', 'o1'),
      row('pi_2', 'o2'),
      row('pi_1', 'o3', 'EUR'),
    ]);

    expect([...grouped.keys()]).toEqual(['pi_1', 'pi_2']);
    expect(grouped.get('pi_1')?.map(({ id }) => id)).toEqual(['o1']);
    expect(grouped.get('pi_2')?.map(({ id }) => id)).toEqual(['o2']);
  });
});
