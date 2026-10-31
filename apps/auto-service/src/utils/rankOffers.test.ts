import { describe, expect, it } from 'vitest';
import { rankOffers } from './rankOffers';
import { bestPrice } from './bestPrice';

const offer = (
  id: string,
  price: number,
  stock_quantity: number,
  lead_time_days = 0,
  currency = 'RSD',
) => ({ id, price, currency, stock_quantity, lead_time_days });

const ids = (offers: { id: string }[]) => offers.map(({ id }) => id);

describe('rankOffers', () => {
  it('drops an offer at the same price that only arrives later', () => {
    expect(
      ids(rankOffers([offer('later', 6600, 2, 2), offer('now', 6600, 3)])),
    ).toEqual(['now']);
  });

  it('keeps one of two identical offers', () => {
    expect(ids(rankOffers([offer('a', 1000, 1), offer('b', 1000, 1)]))).toEqual(
      ['a'],
    );
  });

  it('keeps a cheaper offer that takes longer, after the one in stock', () => {
    expect(
      ids(rankOffers([offer('cheap', 1125, 0, 2), offer('stock', 1200, 4)])),
    ).toEqual(['stock', 'cheap']);
  });

  it('drops a dearer offer that is no faster', () => {
    expect(
      ids(
        rankOffers([
          offer('dear', 2400, 0, 3),
          offer('cheap', 1800, 0, 2),
          offer('fast', 2600, 5),
        ]),
      ),
    ).toEqual(['fast', 'cheap']);
  });

  it('drops an offer nobody can buy when a buyable one is no dearer', () => {
    expect(
      ids(rankOffers([offer('gone', 1500, 0), offer('ok', 1500, 0, 4)])),
    ).toEqual(['ok']);
  });

  it('keeps a cheaper unbuyable offer behind the buyable ones', () => {
    expect(
      ids(rankOffers([offer('gone', 900, 0), offer('ok', 1500, 1)])),
    ).toEqual(['ok', 'gone']);
  });

  it('never compares prices across currencies', () => {
    expect(
      ids(rankOffers([offer('rsd', 100, 1), offer('eur', 200, 1, 0, 'EUR')])),
    ).toEqual(['rsd', 'eur']);
  });

  it('leads with the offer the sticky buy button picks', () => {
    const offers = [
      offer('a', 2200, 0, 2),
      offer('b', 1700, 0, 4),
      offer('c', 2500, 1, 3),
      offer('d', 2500, 2),
    ];
    expect(rankOffers(offers)[0].id).toBe(bestPrice([{ offers }])!.id);
  });

  it('returns nothing for no offers', () => {
    expect(rankOffers([])).toEqual([]);
  });
});
