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
    moreOffers: 'Другие предложения ({count})',
    moreOffersCheaper: 'Другие предложения ({count}), дешевле от {price}',
  };
  const money = ({ price }: { price: number }) => `${price} RSD`;

  it('says a folded offer is cheaper and how much it costs', () => {
    expect(
      moreOffersLabel(
        offerSummary([offer(1200, 4), offer(990, 0, 2)]),
        copy,
        money,
      ),
    ).toBe('Другие предложения (1), дешевле от 990 RSD');
  });

  it('only counts the folded offers when none is cheaper', () => {
    expect(
      moreOffersLabel(
        offerSummary([offer(1200, 0, 2), offer(1500, 0, 1)]),
        copy,
        money,
      ),
    ).toBe('Другие предложения (1)');
  });
});
