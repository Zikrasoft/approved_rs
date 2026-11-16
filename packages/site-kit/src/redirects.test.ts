import { describe, expect, it } from 'vitest';
import {
  createRedirectMatcher,
  shadowedRedirects,
  type Redirect,
} from './redirects.ts';

const rule = (source: string, destination: string): Redirect => ({
  source,
  destination,
});

describe('createRedirectMatcher', () => {
  const match = createRedirectMatcher([
    rule('/:locale(ru|en)/old/:path*', '/:locale/new/:path*'),
    rule('/:locale(ru|en)/old/:path*/', '/:locale/new/:path*'),
    rule(
      '/:locale(ru|en)/hub/:slug+',
      'https://brand.example/:locale/works/:slug+/',
    ),
    rule('/:locale(ru|en)/buy/:country(de|es)', '/:locale/buy/'),
    rule('/exact', '/ru/target'),
  ]);

  it.each([
    ['/en/old', '/en/new/'],
    ['/en/old/', '/en/new/'],
    ['/en/old/de', '/en/new/de'],
    ['/ru/old/de/berlin', '/ru/new/de/berlin'],
    ['/ru/old/de/berlin/', '/ru/new/de/berlin'],
    ['/en/hub/bmw-x3', 'https://brand.example/en/works/bmw-x3/'],
    ['/en/hub/a/b', 'https://brand.example/en/works/a/b/'],
    ['/ru/buy/de', '/ru/buy/'],
    ['/exact', '/ru/target'],
  ])('sends %s to %s', (path, target) => {
    expect(match(path)).toBe(target);
  });

  it.each([
    '/sr/old/de',
    '/en/hub',
    '/en/hub/',
    '/ru/buy/de/',
    '/ru/buy/rs',
    '/exact/',
    '/EXACT',
    '/ru/oldish',
  ])('leaves %s alone', (path) => {
    expect(match(path)).toBeNull();
  });

  it('applies the first matching rule', () => {
    const first = createRedirectMatcher([
      rule('/a/:path*', '/first/:path*'),
      rule('/a/b', '/second'),
    ]);
    expect(first('/a/b')).toBe('/first/b');
  });

  it('counts an unnamed group toward the positions of named ones', () => {
    expect(
      createRedirectMatcher([rule('/(a|b)/:slug', '/x/:slug')])('/b/c'),
    ).toBe('/x/c');
  });
});

describe('shadowedRedirects', () => {
  const rules = [
    rule('/old', '/ru/new/'),
    rule('/old/', '/ru/new/'),
    rule('/legacy.txt', '/ru/'),
    rule('/', '/ru/'),
  ];

  it('names every path a page directory is served under that a rule also matches', () => {
    expect(shadowedRedirects(rules, ['/old/index.html'])).toEqual([
      '/old/',
      '/old',
    ]);
  });

  it('names a plain file a rule matches', () => {
    expect(shadowedRedirects(rules, ['/legacy.txt'])).toEqual(['/legacy.txt']);
  });

  it('serves the root index under the bare root', () => {
    expect(shadowedRedirects(rules, ['/index.html'])).toEqual(['/']);
  });

  it('passes files no rule matches', () => {
    expect(
      shadowedRedirects(rules, ['/ru/index.html', '/_astro/app.js']),
    ).toEqual([]);
  });
});
