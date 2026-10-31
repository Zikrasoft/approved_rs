import { describe, expect, it } from 'vitest';
import { bestPrice, moreOffersLabel, offerSummary } from './bestPrice';

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

  it('starts from the shown price only when the page shows a dearer offer beside it', () => {
    expect(
      bestPrice([{ offers: [offer(1200, 4), offer(1500, 0, 2)] }]),
    ).toMatchObject({ price: 1200, startsFrom: false });
    expect(
      bestPrice([{ offers: [offer(1200, 0, 2), offer(1500, 0, 1)] }]),
    ).toMatchObject({ price: 1200, startsFrom: true });
    expect(bestPrice([{ offers: [offer(1200, 4)] }])).toMatchObject({
      startsFrom: false,
    });
  });

  it('never starts from a price two equal offers share', () => {
    expect(
      bestPrice([
        {
          offers: [
            { ...offer(6600, 5), id: 'a' },
            { ...offer(6600, 3, 2), id: 'b' },
          ],
        },
      ]),
    ).toMatchObject({ price: 6600, startsFrom: false });
  });

  it('never starts from the shown price while a cheaper offer is folded', () => {
    expect(
      bestPrice([{ offers: [offer(1200, 4), offer(990, 0, 2)] }]),
    ).toMatchObject({ price: 1200, startsFrom: false });
  });

  it('has nothing to show for a part priced on request', () => {
    expect(bestPrice([{ offers: [] }])).toBeNull();
  });
});

describe('offerSummary', () => {
  it('folds the offers behind the best one and names the cheapest folded one that can be bought', () => {
    const summary = offerSummary([
      offer(1200, 4),
      offer(990, 0, 2),
      offer(800, 0),
    ]);
    expect(summary.best?.price).toBe(1200);
    expect(summary.others.map(({ price }) => price)).toEqual([990, 800]);
    expect(summary.cheaper?.price).toBe(990);
  });

  it('names no cheaper offer when every folded one costs as much or more', () => {
    expect(
      offerSummary([offer(1200, 0, 2), offer(1500, 0, 1)]).cheaper,
    ).toBeNull();
  });

  it('has no best offer for a part priced on request', () => {
    expect(offerSummary([])).toEqual({
      best: null,
      others: [],
      cheaper: null,
      startsFrom: false,
    });
  });
});

describe('moreOffersLabel', () => {
  const copy = {
    moreOffers: 'Еще одно предложение: {offer}',
    moreOffersCheaper: 'Есть дешевле: {offer}',
    moreOffersSeveral: {
      one: 'Еще {count} предложение, от {price}',
      few: 'Еще {count} предложения, от {price}',
      many: 'Еще {count} предложений, от {price}',
      other: 'Еще {count} предложения, от {price}',
    },
    offerTomorrow: 'завтра',
    offerDays: { other: 'через {days} дня' },
  };
  const money = ({ price }: { price: number }) => `${price} RSD`;
  const label = (offers: ReturnType<typeof offer>[]) =>
    moreOffersLabel(offerSummary(offers), copy, money, 'ru');

  it('names the one cheaper offer with its price and when it can be collected', () => {
    expect(label([offer(1200, 4), offer(990, 0, 2)])).toBe(
      'Есть дешевле: 990 RSD, через 2 дня',
    );
  });

  it('names the one other offer when it is not cheaper', () => {
    expect(label([offer(1200, 0, 2), offer(1500, 0, 1)])).toBe(
      'Еще одно предложение: 1500 RSD, завтра',
    );
  });

  it('counts several offers with a plural and the lowest of their prices', () => {
    expect(label([offer(1500, 4), offer(1200, 0, 1), offer(990, 0, 3)])).toBe(
      'Еще 2 предложения, от 990 RSD',
    );
    expect(
      label([
        offer(2000, 4),
        ...[1, 2, 3, 4, 5].map((days) => offer(1900 - days * 100, 0, days)),
      ]),
    ).toBe('Еще 5 предложений, от 1400 RSD');
  });
});
