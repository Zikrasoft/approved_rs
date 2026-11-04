import {
  DEMAND_WEIGHTS,
  POPULAR_MIN_SIGNALS,
  rankDemand,
  TOP_IN_CATEGORY,
} from '../ranking';

const row = (
  id: string,
  counts: Partial<{ inquiries: number; orders: number; picks: number }>,
  category_id: string | null = 'oil-filters',
) => ({ id, category_id, inquiries: 0, orders: 0, picks: 0, ...counts });

describe('rankDemand', () => {
  it('weighs an order over an inquiry over a pick', () => {
    const ranked = rankDemand([
      row('a', { orders: 1 }),
      row('b', { inquiries: 1 }),
      row('c', { picks: 1 }),
    ]);

    expect(ranked.get('a')?.score).toBe(5);
    expect(ranked.get('b')?.score).toBe(3);
    expect(ranked.get('c')?.score).toBe(1);
    expect(DEMAND_WEIGHTS).toEqual({ orders: 5, inquiries: 3, picks: 1 });
  });

  it('calls a number popular only from the named count of orders and inquiries on, never from picks', () => {
    const ranked = rankDemand([
      row('below', { inquiries: POPULAR_MIN_SIGNALS - 1, picks: 50 }),
      row('at', { inquiries: POPULAR_MIN_SIGNALS - 1, orders: 1 }),
    ]);

    expect(ranked.get('below')).toMatchObject({ popular: false, top: false });
    expect(ranked.get('at')).toMatchObject({ popular: true, top: true });
  });

  it('marks the named number of most demanded popular numbers in each Category as its top', () => {
    const popular = Array.from({ length: TOP_IN_CATEGORY + 1 }, (_, index) =>
      row(`p${index}`, { inquiries: POPULAR_MIN_SIGNALS + index }),
    );
    const ranked = rankDemand([
      ...popular,
      row('elsewhere', { inquiries: POPULAR_MIN_SIGNALS }, 'brake-pads'),
    ]);

    expect(ranked.get('p0')?.top).toBe(false);
    expect(popular.slice(1).map(({ id }) => ranked.get(id)?.top)).toEqual(
      Array(TOP_IN_CATEGORY).fill(true),
    );
    expect(ranked.get('elsewhere')?.top).toBe(true);
  });

  it('breaks a tie in score by id, so the top does not depend on row order', () => {
    const tied = Array.from({ length: TOP_IN_CATEGORY + 1 }, (_, index) =>
      row(`t${index}`, { inquiries: POPULAR_MIN_SIGNALS }),
    );
    const ranked = rankDemand([...tied].reverse());

    expect(ranked.get(`t${TOP_IN_CATEGORY}`)?.top).toBe(false);
    expect(ranked.get('t0')?.top).toBe(true);
  });

  it('never tops a number without a Category', () => {
    expect(
      rankDemand([row('loose', { orders: 5 }, null)]).get('loose'),
    ).toEqual({ score: 25, popular: true, top: false });
  });
});
