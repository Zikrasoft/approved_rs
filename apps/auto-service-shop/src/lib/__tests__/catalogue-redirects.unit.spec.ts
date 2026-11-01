import { latestPartRedirects } from '../catalogue-redirects';

describe('latestPartRedirects', () => {
  it('keeps only the last redirect of a part page deleted more than once', () => {
    const first = { id: 'r1', kind: 'part', from_slug: 'mann-hu816x' };
    const model = { id: 'r2', kind: 'model', from_slug: 'f30' };
    const again = { id: 'r3', kind: 'part', from_slug: 'mann-hu816x' };
    const other = { id: 'r4', kind: 'part', from_slug: 'bosch-1' };

    expect(latestPartRedirects([first, model, again, other])).toEqual([
      model,
      again,
      other,
    ]);
  });
});
