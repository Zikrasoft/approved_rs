import { describe, expect, it } from 'vitest';
import { SITE_NAME } from './constants';
import { listingHeading, listingTitle, neighbours } from './listing';

const copy = {
  heading: 'Блог',
  pageName: 'Блог, страница {page}',
  metaTitle: 'Блог о ремонте',
};

describe('a paged listing', () => {
  it('heads its first page with the heading and later ones with the page name', () => {
    expect(listingHeading(1, copy)).toBe('Блог');
    expect(listingHeading(3, copy)).toBe('Блог, страница 3');
  });

  it('titles its first page with the meta title and later ones with the heading and the site', () => {
    expect(listingTitle(1, copy)).toBe('Блог о ремонте');
    expect(listingTitle(2, copy)).toBe(`Блог, страница 2 | ${SITE_NAME}`);
  });

  it('links a page to the one before and after it, where they exist', () => {
    const href = (number: number) => `/p/${number}/`;
    expect(neighbours({ number: 1, count: 1 }, href)).toEqual({
      prev: null,
      next: null,
    });
    expect(neighbours({ number: 2, count: 3 }, href)).toEqual({
      prev: '/p/1/',
      next: '/p/3/',
    });
  });
});
