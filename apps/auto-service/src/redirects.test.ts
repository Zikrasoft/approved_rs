import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createRedirectMatcher,
  unprefixedSectionRedirects,
} from '@podbor/site-kit/redirects';
import { PRIMARY_LOCALE } from './i18n/config';
import {
  categoryCaseRedirects,
  categoryFirstPageRedirects,
  legacyCategoryRedirects,
  legacyShopRedirects,
  siteRedirects,
} from './utils/legacyCategories';
import { PathBuilder } from './utils/paths';

const redirectFor = createRedirectMatcher([
  ...legacyCategoryRedirects(),
  ...legacyShopRedirects(),
  ...categoryFirstPageRedirects(),
  ...unprefixedSectionRedirects(PathBuilder, PRIMARY_LOCALE),
]);

describe('redirects', () => {
  it.each([
    ['/services', '/sr/services/'],
    ['/services/brakes-suspension', '/sr/services/brakes-suspension'],
    ['/works/bmw-x3', '/sr/works/bmw-x3'],
    ['/parts/brakes', '/sr/parts/brakes'],
    ['/contact/', '/sr/contact/'],
    ['/thanks', '/sr/thanks/'],
    ['/privacy/', '/sr/privacy/'],
    ['/about', '/sr/about/'],
  ])('sends %s to %s', (path, target) => {
    expect(redirectFor(path)).toBe(target);
  });

  it.each([
    ['/bmw', '/sr/cars/bmw/'],
    ['/bmw/', '/sr/cars/bmw/'],
    ['/ru/bmw/', '/ru/cars/bmw/'],
    ['/sr/bmw', '/sr/cars/bmw/'],
    ['/en/bmw/', '/en/cars/bmw/'],
  ])('sends the old BMW page %s to the BMW Make page %s', (path, target) => {
    expect(createRedirectMatcher(siteRedirects())(path)).toBe(target);
  });

  it('ships the old BMW page redirect to the edge as permanent', () => {
    expect(edgeRules()).toEqual(
      expect.arrayContaining([
        { source: '/bmw/', destination: '/sr/cars/bmw/', permanent: true },
        { source: '/en/bmw', destination: '/en/cars/bmw/', permanent: true },
      ]),
    );
  });

  it.each([
    [
      '/sr/parts/maintenance-consumables/',
      '/sr/parts/c/maintenance-consumables/',
    ],
    ['/sr/parts/brakes', '/sr/parts/c/brakes/'],
    ['/en/parts/suspension/', '/en/parts/c/suspension/'],
    ['/ru/parts/engine-parts/', '/ru/parts/c/engine-parts/'],
    ['/sr/parts/electrics/', '/sr/parts/c/electrics/'],
    ['/en/parts/transmission', '/en/parts/c/transmission/'],
    ['/ru/parts/body-parts/', '/ru/parts/c/body-parts/'],
  ])('answers the placeholder category %s with a 301 to %s', (path, target) => {
    expect(redirectFor(path)).toBe(target);
  });

  it('ships every placeholder category redirect as a permanent edge redirect', () => {
    const { redirects } = JSON.parse(
      readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
    );

    expect(redirects).toEqual(
      expect.arrayContaining([
        {
          source: '/sr/parts/brakes/',
          destination: '/sr/parts/c/brakes/',
          permanent: true,
        },
      ]),
    );
  });

  it.each([
    ['/sr/shop/cart/', '/sr/parts/cart/'],
    ['/en/shop/checkout', '/en/parts/cart/'],
    ['/ru/shop/part_01ABC/', '/ru/parts/'],
  ])('folds the old shop route %s into %s', (path, target) => {
    expect(redirectFor(path)).toBe(target);
  });

  it.each([
    ['/ru/parts/c/batteries/1/', '/ru/parts/c/batteries/'],
    ['/sr/parts/c/oil-filters/1', '/sr/parts/c/oil-filters/'],
  ])('sends the first category page %s to its canonical %s', (path, target) => {
    expect(redirectFor(path)).toBe(target);
  });

  const edgeRules = () =>
    JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
      .redirects;

  it('ships the first category page redirect without a query of its own, so the edge forwards the visitor query', () => {
    expect(edgeRules()).toEqual(
      expect.arrayContaining([
        {
          source: '/ru/parts/c/:slug/1/',
          destination: '/ru/parts/c/:slug/',
          permanent: true,
        },
      ]),
    );
  });

  it('ships the category case redirects to the edge', () => {
    expect(edgeRules()).toEqual(
      expect.arrayContaining(categoryCaseRedirects()),
    );
  });

  const caseMatch = createRedirectMatcher(
    categoryCaseRedirects().map((rule) => ({ ...rule, destination: '/hit' })),
  );

  it.each(['/ru/parts/c/BATTERIES/', '/sr/parts/c/Oil-Filters'])(
    'sends the capitalised category %s through the search, which lower-cases it',
    (path) => {
      expect(caseMatch(path)).toBe('/hit');
    },
  );

  it.each(['/ru/parts/c/batteries/', '/ru/parts/c/BATTERIES/2/'])(
    'leaves %s to its route',
    (path) => {
      expect(caseMatch(path)).toBeNull();
    },
  );

  it('points a capitalised category at the search for it', () => {
    expect(categoryCaseRedirects()).toContainEqual({
      source: '/ru/parts/c/:slug([^/]*[A-Z][^/]*)/',
      destination: '/ru/parts/search/?category=:slug',
      permanent: true,
    });
  });

  it.each([
    '/ru/parts/c/batteries/2/',
    '/ru/parts/c/batteries/10/',
    '/',
    '/sr/',
    '/sr/parts/cart/',
    '/en/parts/',
    '/sr/parts/c/brakes/',
    '/sr/parts/p/mann-filter-hu816x/',
    '/llms.txt',
  ])('leaves %s alone', (path) => {
    expect(redirectFor(path)).toBeNull();
  });
});
