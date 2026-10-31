import { describe, expect, it } from 'vitest';
import { bestOffer, isBuyable, orderCap, rankOffers } from './availability.ts';

describe('offer availability', () => {
  it('caps an in-stock offer at its stock', () => {
    expect(orderCap({ stock_quantity: 30, lead_time_days: 4 })).toBe(30);
  });

  it('lets a lead-time offer with little stock order up to ten', () => {
    expect(orderCap({ stock_quantity: 1, lead_time_days: 4 })).toBe(10);
  });

  it('caps a stocked offer without lead time at its stock', () => {
    expect(orderCap({ stock_quantity: 1, lead_time_days: 0 })).toBe(1);
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

const offer = (
  id: string,
  price: number,
  stock_quantity: number,
  lead_time_days = 0,
  currency = 'RSD',
) => ({ id, price, currency, stock_quantity, lead_time_days });

const ids = (offers: { id: string }[]) => offers.map(({ id }) => id);

describe('offer ranking', () => {
  it.each([
    [
      'puts a buyable offer before a cheaper one nobody can buy',
      [offer('gone', 900, 0), offer('later', 1500, 0, 4)],
      'later',
      ['later', 'gone'],
    ],
    [
      'puts stock before a cheaper back order',
      [offer('cheap', 1125, 0, 2), offer('stock', 1200, 4)],
      'stock',
      ['stock', 'cheap'],
    ],
    [
      'breaks a price tie on the shorter wait',
      [offer('slow', 6600, 2, 2), offer('now', 6600, 3)],
      'now',
      ['now'],
    ],
    [
      'breaks a price tie on the shorter wait across currencies',
      [offer('slow', 6600, 2, 2, 'EUR'), offer('now', 6600, 3)],
      'now',
      ['now', 'slow'],
    ],
    [
      'keeps the first of two identical offers',
      [offer('a', 1000, 1), offer('b', 1000, 1)],
      'a',
      ['a'],
    ],
    [
      'never drops an offer priced in another currency',
      [offer('eur', 200, 1, 0, 'EUR'), offer('rsd', 100, 1)],
      'rsd',
      ['rsd', 'eur'],
    ],
    [
      'drops a dearer offer that is no faster',
      [
        offer('dear', 2400, 0, 3),
        offer('cheap', 1800, 0, 2),
        offer('fast', 2600, 5),
      ],
      'fast',
      ['fast', 'cheap'],
    ],
    [
      'drops an offer nobody can buy when a buyable one is no dearer',
      [offer('gone', 1500, 0), offer('ok', 1500, 0, 4)],
      'ok',
      ['ok'],
    ],
    [
      'ranks offers nobody can buy by price',
      [offer('dear', 1500, 0), offer('cheap', 900, 0, 0, 'EUR')],
      'cheap',
      ['cheap', 'dear'],
    ],
  ])('%s', (_, offers, best, ranked) => {
    expect(bestOffer(offers)?.id).toBe(best);
    expect(ids(rankOffers(offers))).toEqual(ranked);
    expect(rankOffers(offers)[0]).toBe(bestOffer(offers));
  });

  it('ranks nothing for no offers', () => {
    expect(bestOffer([])).toBeNull();
    expect(rankOffers([])).toEqual([]);
  });

  it('leaves the offers it ranks in their order', () => {
    const offers = [offer('dear', 2000, 1), offer('cheap', 1000, 1)];
    bestOffer(offers);
    expect(ids(offers)).toEqual(['dear', 'cheap']);
  });
});
