import { describe, expect, it } from 'vitest';
import { paginate, pageWindow } from './pagination.ts';

describe('pageWindow', () => {
  it('lists every page of a short listing', () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });

  it('keeps the ends and the neighbours of the current page, with a gap between', () => {
    expect(pageWindow(5, 9)).toEqual([1, 'gap', 4, 5, 6, 'gap', 9]);
  });

  it('opens no gap when only the neighbour is missing on one side', () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 'gap', 4]);
    expect(pageWindow(3, 4)).toEqual([1, 2, 3, 4]);
  });

  it('has the one page of a single-page listing', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 5 }, (_, index) => index + 1);

  it('has one empty page for an empty list', () => {
    expect(paginate([], 2)).toEqual([{ number: 1, count: 1, items: [] }]);
  });

  it('fills every page when the list is an exact multiple of the size', () => {
    expect(paginate(items.slice(0, 4), 2)).toEqual([
      { number: 1, count: 2, items: [1, 2] },
      { number: 2, count: 2, items: [3, 4] },
    ]);
  });

  it('leaves the last page partial', () => {
    expect(paginate(items, 2).map(({ items: page }) => page)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });

  it('numbers pages from one and carries the count on each', () => {
    expect(
      paginate(items, 2).map(({ number, count }) => [number, count]),
    ).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('has no page beyond the last', () => {
    expect(
      paginate(items, 2).find(({ number }) => number === 4),
    ).toBeUndefined();
  });
});
