import { describe, expect, it } from 'vitest';
import {
  MAKES_PAGE_PATH,
  makePagePath,
  makePageResponseSchema,
  makesPageResponseSchema,
} from './makePageView.ts';

describe('the makes page contract', () => {
  it('addresses the list and one Make under the catalogue pages', () => {
    expect(MAKES_PAGE_PATH).toBe('/store/catalogue-pages/makes');
    expect(makePagePath('land rover')).toBe(
      '/store/catalogue-pages/makes/land%20rover',
    );
  });

  it('strips a key a newer shop adds', () => {
    expect(
      makesPageResponseSchema.parse({
        makes: [{ slug: 'bmw', name: 'BMW', logo: 'x' }],
        total: 1,
      }),
    ).toEqual({ makes: [{ slug: 'bmw', name: 'BMW' }] });
    expect(
      makePageResponseSchema.parse({
        make: { slug: 'bmw', name: 'BMW' },
        series: [{ slug: '1', name: '1', category_names: ['Oil'], extra: 1 }],
      }).series[0],
    ).toEqual({ slug: '1', name: '1', category_names: ['Oil'] });
  });

  it('refuses an answer without its Make', () => {
    expect(makePageResponseSchema.safeParse({ series: [] }).success).toBe(
      false,
    );
  });
});
