import { describe, expect, it } from 'vitest';
import {
  createRedirectMatcher,
  withRedirects,
  type Redirect,
} from './redirects.ts';

const rule = (source: string, destination: string): Redirect => ({
  source,
  destination,
  permanent: true,
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

describe('withRedirects', () => {
  it('replaces only the redirects key and keeps key order', () => {
    const before = JSON.stringify({
      framework: 'astro',
      redirects: [rule('/old', '/new')],
      headers: [],
    });
    const after = withRedirects(before, [rule('/a', '/b')]);
    expect(after).toBe(
      `${JSON.stringify(
        { framework: 'astro', redirects: [rule('/a', '/b')], headers: [] },
        null,
        2,
      )}\n`,
    );
  });

  it('adds the key when the file has none', () => {
    expect(JSON.parse(withRedirects('{}', []))).toEqual({ redirects: [] });
  });
});
