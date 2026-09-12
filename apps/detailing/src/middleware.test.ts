import { describe, it, expect, vi, beforeEach } from 'vitest';

let hasLocale = false;

vi.mock('astro:middleware', () => ({ defineMiddleware: (fn: unknown) => fn }));
vi.mock('astro:i18n', () => ({ requestHasLocale: () => hasLocale }));

const { isUnlocalized, onRequest } = await import('./middleware');

type Handler = (context: unknown, next: () => unknown) => unknown;

function makeContext(url: string, acceptLanguage = '', cookie?: string) {
  const set = vi.fn();
  return {
    url: new URL(url, 'https://prizma.rs'),
    request: {
      headers: {
        get: (name: string) =>
          name === 'accept-language' ? acceptLanguage : null,
      },
    },
    cookies: {
      set,
      get: () => (cookie ? { value: cookie } : undefined),
    },
    redirect: vi.fn((path: string, status?: number) => ({ path, status })),
  };
}

const run = (context: unknown, next = vi.fn(() => 'next')) =>
  (onRequest as unknown as Handler)(context, next);

describe('isUnlocalized', () => {
  it.each([
    '/api/leads',
    '/api/contact-click',
    '/keystatic',
    '/keystatic/collection/works',
    '/_image?href=x',
    '/robots.txt',
    '/404',
    '/404/',
    '/sitemap-index.xml',
    '/sitemap-0.xml',
  ])('leaves %s alone', (pathname) => {
    expect(isUnlocalized(pathname)).toBe(true);
  });

  it.each(['/', '/ru/', '/services/', '/sr/works/bmw-x5/', '/contact'])(
    'routes %s through locale handling',
    (pathname) => {
      expect(isUnlocalized(pathname)).toBe(false);
    },
  );

  it('does not treat a content page merely containing "api" as unlocalized', () => {
    expect(isUnlocalized('/ru/works/mapi/')).toBe(false);
  });
});

describe('onRequest', () => {
  beforeEach(() => {
    hasLocale = false;
  });

  it('passes an unlocalized path straight through without touching cookies', () => {
    const context = makeContext('/api/leads');
    const next = vi.fn(() => 'next');
    expect(run(context, next)).toBe('next');
    expect(next).toHaveBeenCalledTimes(1);
    expect(context.cookies.set).not.toHaveBeenCalled();
    expect(context.redirect).not.toHaveBeenCalled();
  });

  it('continues to a localized page and remembers the locale in a cookie', () => {
    hasLocale = true;
    const context = makeContext('/sr/services/');
    const next = vi.fn(() => 'next');
    expect(run(context, next)).toBe('next');
    expect(context.cookies.set).toHaveBeenCalledWith(
      'lang',
      'sr',
      expect.objectContaining({ path: '/' }),
    );
  });

  it('redirects the bare root to the detected locale rather than rewriting to a prerendered page', () => {
    const context = makeContext('/', 'en-GB,en;q=0.9');
    run(context);
    expect(context.redirect).toHaveBeenCalledWith('/en/', 302);
  });

  it('prefers the cookie over Accept-Language at the root', () => {
    const context = makeContext('/', 'en-GB,en;q=0.9', 'sr');
    run(context);
    expect(context.redirect).toHaveBeenCalledWith('/sr/', 302);
  });

  it('falls back to the default locale at the root for an unserved language', () => {
    const context = makeContext('/', 'zh-CN,zh;q=0.9');
    run(context);
    expect(context.redirect).toHaveBeenCalledWith('/ru/', 302);
  });

  it('keeps the query string when redirecting the root', () => {
    const context = makeContext('/?utm_source=ig', 'sr');
    run(context);
    expect(context.redirect).toHaveBeenCalledWith('/sr/?utm_source=ig', 302);
  });

  it('301s an unprefixed content path onto the detected locale, query string included', () => {
    const context = makeContext('/services/paint-protection-film/?ref=x', 'sr');
    run(context);
    expect(context.redirect).toHaveBeenCalledWith(
      '/sr/services/paint-protection-film/?ref=x',
      301,
    );
  });

  it('does not double the locale prefix on an already-prefixed path', () => {
    hasLocale = true;
    const context = makeContext('/en/contact/');
    run(context);
    expect(context.redirect).not.toHaveBeenCalled();
  });
});
