import { keysetPages } from '../keyset-pages';

const rows = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));

const pagesOf = async (take: number) => {
  const calls: (string | undefined)[] = [];
  const pages: string[][] = [];
  for await (const page of keysetPages(async (after, size) => {
    calls.push(after);
    return rows.filter(({ id }) => !after || id > after).slice(0, size);
  }, take)) {
    pages.push(page.map(({ id }) => id));
  }
  return { calls, pages };
};

describe('keysetPages', () => {
  it('reads page after page from the last id until a short page', async () => {
    expect(await pagesOf(2)).toEqual({
      calls: [undefined, 'b', 'd'],
      pages: [['a', 'b'], ['c', 'd'], ['e']],
    });
  });

  it('asks once more after a full last page and stops on the empty one', async () => {
    expect(await pagesOf(5)).toEqual({
      calls: [undefined, 'e'],
      pages: [['a', 'b', 'c', 'd', 'e'], []],
    });
  });
});
