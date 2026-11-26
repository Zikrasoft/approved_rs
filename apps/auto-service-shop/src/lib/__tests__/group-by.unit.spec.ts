import { groupBy } from '../group-by';

describe('groupBy', () => {
  it('groups items by key keeping first-seen key order and item order', () => {
    const groups = groupBy([1, 2, 3, 4, 5], (n) => n % 2);

    expect([...groups]).toEqual([
      [1, [1, 3, 5]],
      [0, [2, 4]],
    ]);
  });

  it('returns no groups for no items', () => {
    expect(groupBy([], String).size).toBe(0);
  });
});
