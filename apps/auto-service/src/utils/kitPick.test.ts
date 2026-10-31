import { describe, expect, it } from 'vitest';
import type { PartOffer } from '@podbor/catalog-contract';
import { kitPick, kitTotal, nameRepeatsCategory } from './kitPick';

const offer = (
  id: string,
  price: number,
  stock_quantity: number,
  lead_time_days = 0,
) =>
  ({
    id,
    price,
    currency: 'RSD',
    stock_quantity,
    lead_time_days,
  }) satisfies PartOffer;

const page = (slug: string, offers: PartOffer[], superseded = false) => ({
  slug,
  superseded,
  offers,
});

describe('kitPick', () => {
  it('picks the cheapest offer in stock across the numbers of a kit item', () => {
    const cheap = page('mann', [offer('o_mann', 900, 2)]);

    expect(
      kitPick([
        page('bmw', [offer('o_bmw', 1200, 5), offer('o_out', 500, 0)]),
        cheap,
      ]),
    ).toEqual({ page: cheap, offer: offer('o_mann', 900, 2) });
  });

  it('names a current number and no offer when nothing can be bought', () => {
    const current = page('bmw-new', [offer('o_out', 500, 0)]);

    expect(kitPick([page('bmw-old', [], true), current])).toEqual({
      page: current,
      offer: null,
    });
  });

  it('falls back to the only number there is', () => {
    const only = page('bmw-old', [], true);

    expect(kitPick([only])).toEqual({ page: only, offer: null });
  });
});

describe('kitTotal', () => {
  it('prices every kit line by its quantity', () => {
    expect(
      kitTotal([
        { price: 1850, quantity: 2 },
        { price: 900, quantity: 1 },
      ]),
    ).toBe(4600);
  });
});

describe('nameRepeatsCategory', () => {
  it('sees a singular name repeat its plural category', () => {
    expect(nameRepeatsCategory('Масляный фильтр', 'Масляные фильтры')).toBe(
      true,
    );
    expect(
      nameRepeatsCategory('Тормозные колодки задние', 'Тормозные колодки'),
    ).toBe(true);
  });

  it('keeps a category the name does not repeat', () => {
    expect(nameRepeatsCategory('Фильтр масляный', 'Фильтры воздушные')).toBe(
      false,
    );
    expect(nameRepeatsCategory('Масло', 'Моторные масла')).toBe(false);
  });
});
