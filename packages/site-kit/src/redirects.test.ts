import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createRedirectMatcher,
  unprefixedSectionRedirects,
  withRedirects,
  writeRedirects,
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

describe('writeRedirects', () => {
  it('rewrites the redirects of the file in place', () => {
    const file = pathToFileURL(
      join(mkdtempSync(join(tmpdir(), 'redirects-')), 'vercel.json'),
    );
    writeFileSync(file, '{"framework":"astro"}');
    writeRedirects(file, [rule('/a', '/b')]);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      framework: 'astro',
      redirects: [rule('/a', '/b')],
    });
  });
});

describe('unprefixedSectionRedirects', () => {
  type Locale = 'sr' | 'en';
  const paths = {
    home: (locale: Locale) => `/${locale}/`,
    services: (locale: Locale) => `/${locale}/services/`,
    service: (locale: Locale, slug: string) => `/${locale}/services/${slug}/`,
    shopProduct: (locale: Locale, type: string, handle: string) =>
      `/${locale}/shop/${type}/${handle}/`,
    contact: (locale: Locale) => `/${locale}/contact/`,
    llmsTxt: (locale: Locale) => `/${locale}/llms.txt`,
  };
  const redirects = unprefixedSectionRedirects(paths, 'sr');

  it('sends a section with nested pages through a catch-all and a single page to its own URL', () => {
    expect(redirects).toEqual([
      rule('/services/:path*', '/sr/services/:path*'),
      rule('/shop/:path*', '/sr/shop/:path*'),
      rule('/contact', '/sr/contact/'),
      rule('/contact/', '/sr/contact/'),
    ]);
  });

  it.each([
    ['/services/brakes', '/sr/services/brakes'],
    ['/services', '/sr/services/'],
    ['/shop/oil/castrol', '/sr/shop/oil/castrol'],
    ['/contact/', '/sr/contact/'],
  ])('sends %s to %s', (path, target) => {
    expect(createRedirectMatcher(redirects)(path)).toBe(target);
  });

  it('never redirects a file', () => {
    expect(createRedirectMatcher(redirects)('/llms.txt')).toBeNull();
  });
});
