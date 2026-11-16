import { describe, expect, it, vi } from 'vitest';
import { createLocaleMiddleware } from './localeMiddleware.ts';

const isLocale = (value: string) => ['ru', 'en', 'sr'].includes(value);

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

const detectLocale = (acceptLanguage: string | null, cookie?: string) =>
  cookie ?? (acceptLanguage?.startsWith('en') ? 'en' : 'sr');

const middleware = createLocaleMiddleware({
  isLocale,
  detectLocale,
  unlocalized: { exact: ['/llms.txt'], prefixes: ['/api/'] },
  redirects: [
    { source: '/ru/old/:path*', destination: '/ru/new/:path*' },
    { source: '/legacy', destination: 'https://brand.example/ru/' },
  ],
});

const next = () => 'next';

describe('createLocaleMiddleware', () => {
  it.each(['/api/leads', '/llms.txt', '/sitemap-index.xml'])(
    'passes the unlocalized %s straight through',
    (path) => {
      const ctx = context(path);
      expect(middleware(ctx, next)).toBe('next');
      expect(ctx.redirect).not.toHaveBeenCalled();
    },
  );

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
