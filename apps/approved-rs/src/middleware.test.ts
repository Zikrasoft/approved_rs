import { describe, it, expect, vi } from 'vitest';
import { SUPPORTED_LOCALES } from './i18n/config';

vi.mock('astro:middleware', () => ({ defineMiddleware: (fn: unknown) => fn }));
vi.mock('astro:i18n', () => ({
  requestHasLocale: (context: { url: URL }) =>
    (SUPPORTED_LOCALES as readonly string[]).includes(
      context.url.pathname.split('/')[1],
    ),
}));

const { onRequest } = await import('./middleware');

type Handler = (context: unknown, next: () => unknown) => unknown;

function makeContext(
  url: string,
  {
    acceptLanguage = '',
    cookie,
  }: {
    acceptLanguage?: string;
    cookie?: string;
  } = {},
) {
  return {
    url: new URL(url, 'https://approved.rs'),
    request: {
      headers: {
        get: (name: string) =>
          name === 'accept-language' ? acceptLanguage : null,
      },
    },
    cookies: {
      set: vi.fn(),
      get: () => (cookie ? { value: cookie } : undefined),
    },
    redirect: vi.fn((path: string, status?: number) => ({ path, status })),
    rewrite: vi.fn((path: string) => ({ path })),
  };
}

const run = (context: unknown, next = vi.fn(() => 'next')) =>
  (onRequest as unknown as Handler)(context, next);

describe('onRequest', () => {
  it('passes an unlocalized path straight through', () => {
    const context = makeContext('/api/leads');
    const next = vi.fn(() => 'next');
    expect(run(context, next)).toBe('next');
    expect(context.redirect).not.toHaveBeenCalled();
  });

  it('serves a localized page without recording it as a language choice', () => {
    const context = makeContext('/en/vehicle-sourcing/de/');
    expect(run(context)).toBe('next');
    expect(context.cookies.set).not.toHaveBeenCalled();
    expect(context.redirect).not.toHaveBeenCalled();
  });

  it('rewrites the bare root to the detected locale without pinning it', () => {
    const context = makeContext('/?utm_source=ig', {
      acceptLanguage: 'en-US,en;q=0.9,ru;q=0.8',
    });
    run(context);
    expect(context.rewrite).toHaveBeenCalledWith('/en/?utm_source=ig');
    expect(context.cookies.set).not.toHaveBeenCalled();
  });

  it('falls back to the primary locale for a language the site does not serve', () => {
    const context = makeContext('/', { acceptLanguage: 'zh-CN,zh;q=0.9' });
    run(context);
    expect(context.rewrite).toHaveBeenCalledWith('/ru/');
  });

  it('still prefers an existing cookie over Accept-Language', () => {
    const context = makeContext('/', {
      acceptLanguage: 'en-GB,en;q=0.9',
      cookie: 'sr',
    });
    run(context);
    expect(context.rewrite).toHaveBeenCalledWith('/sr/');
  });

  it('keeps the query string on the cross-brand 301', () => {
    const context = makeContext('/ru/detailing-belgrade/?utm_source=ig');
    run(context);
    expect(context.redirect).toHaveBeenCalledWith(
      'https://details.rs/ru/services/?utm_source=ig',
      301,
    );
  });

  it('does not redirect a path whose segment only exists on Object.prototype', () => {
    const context = makeContext('/ru/constructor/');
    expect(run(context)).toBe('next');
    expect(context.redirect).not.toHaveBeenCalled();
  });

  it('301s a legacy slug while keeping the locale already in the URL', () => {
    const context = makeContext('/en/autopodbor/de/?ref=x');
    run(context);
    expect(context.redirect).toHaveBeenCalledWith(
      '/en/vehicle-sourcing/de?ref=x',
      301,
    );
  });

  it('301s an unprefixed content path to the detected locale', () => {
    const context = makeContext('/vehicle-sourcing/rs/', {
      acceptLanguage: 'sr-RS,sr;q=0.9',
    });
    run(context);
    expect(context.redirect).toHaveBeenCalledWith(
      '/sr/vehicle-sourcing/rs/',
      301,
    );
  });
});
