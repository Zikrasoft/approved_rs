import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createRedirectMatcher,
  unprefixedSectionRedirects,
} from '@podbor/site-kit/redirects';
import { PRIMARY_LOCALE } from './i18n/config';
import { legacyCategoryRedirects } from './utils/legacyCategories';
import { PathBuilder } from './utils/paths';

const redirectFor = createRedirectMatcher([
  ...legacyCategoryRedirects(),
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
    ['/bmw', '/sr/bmw/'],
  ])('sends %s to %s', (path, target) => {
    expect(redirectFor(path)).toBe(target);
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
    '/',
    '/sr/',
    '/en/parts/',
    '/sr/parts/c/brakes/',
    '/sr/parts/p/mann-filter-hu816x/',
    '/llms.txt',
  ])('leaves %s alone', (path) => {
    expect(redirectFor(path)).toBeNull();
  });
});
