import { describe, expect, it } from 'vitest';
import {
  byDemand,
  demandOf,
  isTopDemand,
  POPULAR_BLOCK_MIN,
  POPULAR_BLOCK_SIZE,
  popularPicks,
} from './demand';

const page = (
  slug: string,
  demand: { score: number; popular: boolean; top: boolean } | null,
) => ({ slug, demand });
const popular = (slug: string, score: number) =>
  page(slug, { score, popular: true, top: false });

describe('popularPicks', () => {
  it('picks nothing below the named number of popular parts, so no block shows on thin demand', () => {
    expect(POPULAR_BLOCK_MIN).toBe(2);
    expect(
      popularPicks([
        popular('a', 9),
        page('b', { score: 40, popular: false, top: false }),
        page('c', null),
      ]),
    ).toEqual([]);
  });

  it('picks the popular parts from the named number on, most demanded first', () => {
    expect(
      popularPicks([popular('a', 6), page('x', null), popular('b', 9)]).map(
        ({ slug }) => slug,
      ),
    ).toEqual(['b', 'a']);
  });

  it('keeps the given order for a tie and shows at most the named number', () => {
    const many = Array.from({ length: POPULAR_BLOCK_SIZE + 2 }, (_, at) =>
      popular(`p${at}`, 6),
    );
    expect(popularPicks(many).map(({ slug }) => slug)).toEqual(
      many.slice(0, POPULAR_BLOCK_SIZE).map(({ slug }) => slug),
    );
  });

  it('shows a part once though several of its numbers are popular', () => {
    const shared = { part: { id: 'part_1' } };
    expect(
      popularPicks([
        { ...popular('a', 9), ...shared },
        { ...popular('b', 6), ...shared },
        { ...popular('c', 3), part: { id: 'part_2' } },
      ]).map(({ slug }) => slug),
    ).toEqual(['a', 'c']);
  });
});

describe('isTopDemand', () => {
  it('holds when any number of a part tops its Category, and never without Demand', () => {
    expect(
      isTopDemand([
        page('a', null),
        page('b', { score: 8, popular: true, top: true }),
      ]),
    ).toBe(true);
    expect(
      isTopDemand([page('a', { score: 30, popular: true, top: false })]),
    ).toBe(false);
    expect(isTopDemand([page('a', null)])).toBe(false);
  });
});

describe('byDemand', () => {
  it('puts the most demanded first and keeps the given order without demand', () => {
    const items = ['a', 'b', 'c', 'd'];
    const score = { b: 3, d: 8 } as Record<string, number>;
    expect(byDemand(items, (item) => score[item] ?? 0)).toEqual([
      'd',
      'b',
      'a',
      'c',
    ]);
    expect(byDemand(items, () => 0)).toEqual(items);
  });
});

describe('demandOf', () => {
  it('sums the score of numbers, reading a number without Demand as none', () => {
    expect(demandOf([popular('a', 6), page('b', null), popular('c', 1)])).toBe(
      7,
    );
  });
});
