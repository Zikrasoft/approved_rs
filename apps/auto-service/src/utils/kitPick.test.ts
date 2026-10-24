import { describe, expect, it } from 'vitest';
import type { PartOffer } from '@podbor/catalog-contract';
import { kitPick } from './kitPick';

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

  it('picks an offer in stock over a cheaper one the supplier brings in', () => {
    const stocked = page('mann', [offer('o_mann', 900, 2)]);

    expect(
      kitPick([page('bmw', [offer('o_lead', 500, 0, 4)]), stocked]),
    ).toEqual({ page: stocked, offer: offer('o_mann', 900, 2) });
  });

  it('picks the cheapest offer the supplier brings in when nothing is in stock', () => {
    const lead = page('bmw', [
      offer('o_out', 400, 0),
      offer('o_lead', 500, 0, 4),
    ]);

    expect(kitPick([lead])).toEqual({
      page: lead,
      offer: offer('o_lead', 500, 0, 4),
    });
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
