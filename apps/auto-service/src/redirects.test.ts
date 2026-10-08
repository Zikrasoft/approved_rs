import { describe, expect, it } from 'vitest';
import {
  createRedirectMatcher,
  unprefixedSectionRedirects,
} from '@podbor/site-kit/redirects';
import { PRIMARY_LOCALE } from './i18n/config';
import { PathBuilder } from './utils/paths';

const redirectFor = createRedirectMatcher(
  unprefixedSectionRedirects(PathBuilder, PRIMARY_LOCALE),
);

describe('redirects', () => {
  it.each([
    ['/services', '/sr/services/'],
    ['/services/brakes-suspension', '/sr/services/brakes-suspension'],
    ['/works/bmw-x3', '/sr/works/bmw-x3'],
    ['/shop/oil/f/5w-30', '/sr/shop/oil/f/5w-30'],
    ['/cart', '/sr/cart/'],
    ['/contact/', '/sr/contact/'],
    ['/thanks', '/sr/thanks/'],
    ['/privacy/', '/sr/privacy/'],
  ])('sends %s to %s', (path, target) => {
    expect(redirectFor(path)).toBe(target);
  });

  it.each(['/', '/sr/', '/en/shop/', '/llms.txt', '/catalog-version.txt'])(
    'leaves %s alone',
    (path) => {
      expect(redirectFor(path)).toBeNull();
    },
  );
});
