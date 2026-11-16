import { describe, expect, it, vi } from 'vitest';
import { createLocaleMiddleware } from './localeMiddleware.ts';

function context(url: string, acceptLanguage = '', cookie?: string) {
  return {
    url: new URL(url, 'https://site.example'),
    request: {
      headers: {
        get: (name: string) =>
          name === 'accept-language' ? acceptLanguage : null,
      },
    },
    cookies: {
      get: (name: string) =>
        name === 'lang' && cookie ? { value: cookie } : undefined,
    },
    redirect: vi.fn((path: string, status: number) => ({ path, status })),
  };
}

const locales = {
  isLocale: (value: string) => ['ru', 'en', 'sr'].includes(value),
  detectLocale: (acceptLanguage: string | null, cookie?: string) =>
    cookie ?? (acceptLanguage?.startsWith('en') ? 'en' : 'sr'),
};

const middleware = createLocaleMiddleware({
  locales,
  unlocalized: { prefixes: ['/admin/'] },
  redirects: [
    { source: '/ru/old/:path*', destination: '/ru/new/:path*' },
    { source: '/legacy', destination: 'https://brand.example/ru/' },
  ],
});

const next = () => 'next';

describe('createLocaleMiddleware', () => {
  it.each([
    '/api/leads',
    '/keystatic',
    '/keystatic/collection/works',
    '/.well-known/apple-app-site-association',
    '/404',
    '/404/',
    '/admin/work-draft',
  ])('passes the unlocalized %s straight through', (path) => {
    const ctx = context(path);
    expect(middleware(ctx, next)).toBe('next');
    expect(ctx.redirect).not.toHaveBeenCalled();
  });

  it.each([
    '/_astro/old.js',
    '/llms.txt',
    '/robots.txt',
    '/favicon.ico',
    '/sitemap-index.xml',
    '/sitemap-0.xml',
    '/catalogue-build.json',
    '/apple-touch-icon-precomposed.png',
    '/og-old.png',
    '/wp-login.php',
    '/ru/llms.txt',
    '/ru/old/photo.jpg',
    '/services/.env',
  ])('passes the file %s through, so a missing one is a plain 404', (path) => {
    const ctx = context(path);
    expect(middleware(ctx, next)).toBe('next');
    expect(ctx.redirect).not.toHaveBeenCalled();
  });

  it.each([
    ['/404.5/', '/sr/404.5/'],
    ['/services/v1.2/brakes', '/sr/services/v1.2/brakes'],
    ['/404/x', '/sr/404/x'],
    ['/robots.txt/', '/sr/robots.txt/'],
    ['/ru-RU/', '/sr/ru-RU/'],
    ['/ru/works/mapi', null],
  ])('reads only the last segment as a file name: %s', (path, target) => {
    const ctx = context(path);
    const result = middleware(ctx, next);
    if (target) expect(result).toEqual({ path: target, status: 302 });
    else expect(result).toBe('next');
  });

  it('does not take a page that merely starts with a prefix word as unlocalized', () => {
    expect(middleware(context('/apiary'), next)).toEqual({
      path: '/sr/apiary',
      status: 302,
    });
  });

  it('needs no extra unlocalized paths from the caller', () => {
    const bare = createLocaleMiddleware({ locales });
    const ctx = context('/api/leads');
    expect(bare(ctx, next)).toBe('next');
    expect(bare(context('/admin/work-draft'), next)).toEqual({
      path: '/sr/admin/work-draft',
      status: 302,
    });
  });

  it('lets /_image fall to the locale redirect, since Caddy answers it first', () => {
    const ctx = context('/_image?href=x');
    middleware(ctx, next);
    expect(ctx.redirect).toHaveBeenCalledWith('/sr/_image?href=x', 302);
  });

  it('passes a path that starts with a locale through', () => {
    expect(middleware(context('/en/services/'), next)).toBe('next');
  });

  it('answers a redirect rule with a permanent redirect, query string kept', () => {
    const ctx = context('/ru/old/a/b?ref=x');
    middleware(ctx, next);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/new/a/b?ref=x', 301);
  });

  it('applies a redirect rule before the locale check', () => {
    const ctx = context('/legacy');
    middleware(ctx, next);
    expect(ctx.redirect).toHaveBeenCalledWith('https://brand.example/ru/', 301);
  });

  it('sends an unprefixed path to the detected locale with a temporary redirect', () => {
    const ctx = context('/services/brakes?ref=x', 'en-GB');
    middleware(ctx, next);
    expect(ctx.redirect).toHaveBeenCalledWith('/en/services/brakes?ref=x', 302);
  });

  it('prefers the locale cookie over Accept-Language', () => {
    const ctx = context('/contact', 'en-GB', 'ru');
    middleware(ctx, next);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/contact', 302);
  });

  it('treats a locale deeper in the path as unprefixed', () => {
    const ctx = context('/anything/ru/');
    middleware(ctx, next);
    expect(ctx.redirect).toHaveBeenCalledWith('/sr/anything/ru/', 302);
  });

  it('redirects the root to the detected locale', () => {
    const ctx = context('/?utm=ig', 'en');
    middleware(ctx, next);
    expect(ctx.redirect).toHaveBeenCalledWith('/en/?utm=ig', 302);
  });
});
