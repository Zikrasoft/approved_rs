import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRedirectMatcher } from '@podbor/site-kit/redirects';
import { REDIRECTS } from './redirects';

const redirectFor = createRedirectMatcher(REDIRECTS);

describe('REDIRECTS', () => {
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

  it('is what vercel.json carries', () => {
    const vercel = JSON.parse(
      readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
    );
    expect(vercel.redirects).toEqual(REDIRECTS);
  });
});
