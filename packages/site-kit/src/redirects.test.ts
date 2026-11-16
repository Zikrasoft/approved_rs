import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  caddySiteConfig,
  createRedirectMatcher,
  unprefixedSectionRedirects,
  withVercelConfig,
  writeCaddySiteConfig,
  writeVercelConfig,
  type Redirect,
} from './redirects.ts';
import { SECURITY_HEADERS } from './securityHeaders.ts';

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

describe('withVercelConfig', () => {
  it('replaces the redirects and headers and keeps key order', () => {
    const before = JSON.stringify({
      framework: 'astro',
      redirects: [rule('/old', '/new')],
      headers: [],
    });
    const after = withVercelConfig(before, [rule('/a', '/b')]);
    expect(after).toBe(
      `${JSON.stringify(
        {
          framework: 'astro',
          redirects: [rule('/a', '/b')],
          headers: SECURITY_HEADERS,
        },
        null,
        2,
      )}\n`,
    );
  });

  it('adds the keys when the file has none', () => {
    expect(JSON.parse(withVercelConfig('{}', []))).toEqual({
      redirects: [],
      headers: SECURITY_HEADERS,
    });
  });
});

describe('writeVercelConfig', () => {
  it('rewrites the redirects and headers of the file in place', () => {
    const file = pathToFileURL(
      join(mkdtempSync(join(tmpdir(), 'redirects-')), 'vercel.json'),
    );
    writeFileSync(file, '{"framework":"astro"}');
    writeVercelConfig(file, [rule('/a', '/b')]);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      framework: 'astro',
      redirects: [rule('/a', '/b')],
      headers: SECURITY_HEADERS,
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

describe('caddySiteConfig', () => {
  it('sets every security header on every response and hides the server', () => {
    expect(caddySiteConfig([])).toBe(
      [
        'header {',
        '\tdefer',
        '\tContent-Security-Policy "frame-ancestors \'self\'"',
        `\tContent-Security-Policy-Report-Only ${JSON.stringify(SECURITY_HEADERS[0]!.headers[1]!.value)}`,
        '\tX-Content-Type-Options "nosniff"',
        '\tReferrer-Policy "strict-origin-when-cross-origin"',
        '\tPermissions-Policy "camera=(), microphone=(), geolocation=()"',
        '\tStrict-Transport-Security "max-age=63072000; includeSubDomains"',
        '\t-Server',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('redirects in rule order, permanent as 308, temporary as 307, keeping the query', () => {
    expect(
      caddySiteConfig([
        rule('/a/', '/ru/a/'),
        { source: '/b', destination: 'https://x.rs/b', permanent: false },
      ]).split('}\n')[1],
    ).toBe(
      [
        '@redirect0 path_regexp redirect0 `^\\/a\\/$`',
        'redir @redirect0 /ru/a/{?query} 308',
        '@redirect1 path_regexp redirect1 `^\\/b$`',
        'redir @redirect1 https://x.rs/b{?query} 307',
        '',
      ].join('\n'),
    );
  });

  it('carries every captured segment into the destination by position', () => {
    expect(
      caddySiteConfig([
        rule('/:locale(ru|en)/old/:path*', '/:locale/new/:path*'),
      ]),
    ).toContain(
      'redir @redirect0 /{re.redirect0.1}/new/{re.redirect0.2}{?query} 308',
    );
  });
});

describe('writeCaddySiteConfig', () => {
  it('writes the site config to the file', () => {
    const file = pathToFileURL(
      join(mkdtempSync(join(tmpdir(), 'redirects-')), 'site.caddy'),
    );
    writeCaddySiteConfig(file, [rule('/a', '/b')]);
    expect(readFileSync(file, 'utf8')).toBe(
      caddySiteConfig([rule('/a', '/b')]),
    );
  });
});
