import { describe, expect, it } from 'vitest';
import { carsUrls, catalogueUrls, sitemapFilter } from './sitemap';

const SITE = 'https://carlab.rs';

describe('sitemapFilter', () => {
  it('keeps ordinary pages', () => {
    const keep = sitemapFilter(SITE);
    expect(keep(`${SITE}/sr/services/`)).toBe(true);
    expect(keep(`${SITE}/sr/parts/makes/`)).toBe(true);
    expect(keep(`${SITE}/sr/services/vin-parts-inquiry/`)).toBe(true);
  });

  it('lists /cars/, its later pages and the Make pages', () => {
    const keep = sitemapFilter(SITE);
    expect(keep(`${SITE}/ru/cars/`)).toBe(true);
    expect(keep(`${SITE}/ru/cars/2/`)).toBe(true);
    expect(keep(`${SITE}/sr/cars/bmw/`)).toBe(true);
    expect(keep(`${SITE}/en/cars/mercedes-benz/`)).toBe(true);
  });

  it('lists the blog, its later pages and every Article', () => {
    const keep = sitemapFilter(SITE);
    expect(keep(`${SITE}/sr/blog/`)).toBe(true);
    expect(keep(`${SITE}/sr/blog/2/`)).toBe(true);
    expect(keep(`${SITE}/sr/blog/oil-change/`)).toBe(true);
  });

  it('lists no blog page while the blog lists no Article', () => {
    const keep = sitemapFilter(SITE, [], false);
    expect(keep(`${SITE}/sr/blog/`)).toBe(false);
    expect(keep(`${SITE}/ru/blog/2/`)).toBe(false);
    expect(keep(`${SITE}/sr/cars/bmw/`)).toBe(true);
  });

  it('never lists the root redirect or the thank-you page', () => {
    const keep = sitemapFilter(SITE);
    expect(keep(`${SITE}/`)).toBe(false);
    expect(keep(`${SITE}/sr/thanks/`)).toBe(false);
  });
});

describe('catalogueUrls', () => {
  const urls = catalogueUrls(SITE, {
    parts: [
      { slug: 'bmw-1', indexable: true },
      { slug: 'bmw-2', indexable: false },
    ],
    makes: [
      { slug: 'bmw', name: 'BMW', hub: true },
      { slug: 'tiny', name: 'Tiny', hub: false },
    ],
    series: [
      { make: 'bmw', slug: '3-series', name: '3', categories: ['brakes'] },
    ],
    categories: [
      { slug: 'brakes', name: 'Brakes', listed: 100 },
      { slug: 'empty', name: 'Empty', listed: null },
    ],
  });

  it('lists every page of the list in every locale, Parts only when indexable', () => {
    expect(urls).toEqual(
      expect.arrayContaining([
        `${SITE}/sr/parts/makes/`,
        `${SITE}/sr/parts/bmw/`,
        `${SITE}/ru/parts/bmw/3-series/`,
        `${SITE}/en/parts/bmw/3-series/brakes/`,
        `${SITE}/sr/parts/p/bmw-1/`,
      ]),
    );
    expect(urls).not.toContain(`${SITE}/sr/parts/tiny/`);
    expect(urls).not.toContain(`${SITE}/sr/parts/p/bmw-2/`);
  });

  it('lists each page of a Category listing and one for an empty Category', () => {
    expect(urls).toEqual(
      expect.arrayContaining([
        `${SITE}/sr/parts/c/brakes/`,
        `${SITE}/sr/parts/c/brakes/2/`,
        `${SITE}/sr/parts/c/brakes/3/`,
        `${SITE}/sr/parts/c/empty/`,
      ]),
    );
    expect(urls).not.toContain(`${SITE}/sr/parts/c/brakes/4/`);
  });
});

describe('carsUrls', () => {
  it('lists /cars/ and each Make in every locale', () => {
    expect(
      carsUrls(SITE, ['audi', 'bmw']).filter((url) => url.includes('/sr/')),
    ).toEqual([
      `${SITE}/sr/cars/`,
      `${SITE}/sr/cars/audi/`,
      `${SITE}/sr/cars/bmw/`,
    ]);
    expect(carsUrls(SITE, [])).toContain(`${SITE}/en/cars/`);
  });

  it('adds a numbered page for every 24 Makes', () => {
    const makes = Array.from({ length: 25 }, (_, index) => `make-${index}`);

    expect(carsUrls(SITE, makes)).toContain(`${SITE}/ru/cars/2/`);
    expect(carsUrls(SITE, makes.slice(0, 24))).not.toContain(
      `${SITE}/ru/cars/2/`,
    );
  });
});
