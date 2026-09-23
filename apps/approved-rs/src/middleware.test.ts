import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { SUPPORTED_LOCALES } from './i18n/config';

vi.mock('astro:middleware', () => ({ defineMiddleware: (fn: unknown) => fn }));
vi.mock('astro:i18n', () => ({
  requestHasLocale: (context: { url: URL }) =>
    (SUPPORTED_LOCALES as readonly string[]).includes(
      context.url.pathname.split('/')[1],
    ),
}));

const {
  renameSlugSegments,
  moveGermanySpoke,
  collapseBuybackCountry,
  movedBrandUrl,
  onRequest,
} = await import('./middleware');

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

describe('renameSlugSegments', () => {
  it('renames a single old service-slug segment', () => {
    expect(renameSlugSegments('/autopodbor/de/')).toBe('/vehicle-sourcing/de/');
  });

  it('renames only the matching segment, preserving the locale prefix', () => {
    expect(renameSlugSegments('/en/autopodbor/de/')).toBe(
      '/en/vehicle-sourcing/de/',
    );
  });

  it('renames every old slug to its new equivalent', () => {
    expect(renameSlugSegments('/privoz/')).toBe('/vehicle-import/');
    expect(renameSlugSegments('/vykup/de/')).toBe('/vehicle-buyback/de/');
    expect(renameSlugSegments('/proverka/de/')).toBe('/vehicle-inspection/de/');
  });

  it('returns null when no segment matches (no redirect needed)', () => {
    expect(renameSlugSegments('/en/vehicle-sourcing/de/')).toBeNull();
    expect(renameSlugSegments('/contacts/')).toBeNull();
  });

  it('chains correctly after LEGACY_PATH_REWRITES output', () => {
    // '/cases/' rewrites to '/cases/autopodbor' in LEGACY_PATH_REWRITES,
    // which must then still get slug-renamed to the current route.
    expect(renameSlugSegments('/cases/autopodbor')).toBe(
      '/cases/vehicle-sourcing',
    );
    // Same for the old country-first pages: '/rs/autopodbor/' rewrites to
    // '/autopodbor/rs' in LEGACY_PATH_REWRITES, which then still needs renaming.
    expect(renameSlugSegments('/autopodbor/rs')).toBe('/vehicle-sourcing/rs');
  });
});

describe('collapseBuybackCountry', () => {
  it('sends a collapsed country page to the buyback hub', () => {
    expect(collapseBuybackCountry('/ru/vehicle-buyback/de/')).toBe(
      '/ru/vehicle-buyback/',
    );
    expect(collapseBuybackCountry('/en/vehicle-buyback/pl/')).toBe(
      '/en/vehicle-buyback/',
    );
  });

  it('leaves Serbia alone — it kept its own page', () => {
    expect(collapseBuybackCountry('/ru/vehicle-buyback/rs/')).toBeNull();
  });

  it('returns null for the hub itself and for other services', () => {
    expect(collapseBuybackCountry('/ru/vehicle-buyback/')).toBeNull();
    expect(collapseBuybackCountry('/ru/vehicle-sourcing/de/')).toBeNull();
  });

  it('matches even without a trailing slash (trailingSlash is "ignore")', () => {
    expect(collapseBuybackCountry('/ru/vehicle-buyback/it')).toBe(
      '/ru/vehicle-buyback/',
    );
  });
});

describe('moveGermanySpoke', () => {
  it('nests the old Germany spoke path under /eu/', () => {
    expect(moveGermanySpoke('/vehicle-import/de/')).toBe(
      '/vehicle-import/eu/de/',
    );
    expect(moveGermanySpoke('/en/vehicle-import/de/')).toBe(
      '/en/vehicle-import/eu/de/',
    );
  });

  it('returns null for unrelated paths', () => {
    expect(moveGermanySpoke('/en/vehicle-sourcing/de/')).toBeNull();
    expect(moveGermanySpoke('/en/vehicle-import/eu/')).toBeNull();
  });

  it('matches even without a trailing slash (trailingSlash is "ignore")', () => {
    expect(moveGermanySpoke('/vehicle-import/de')).toBe(
      '/vehicle-import/eu/de/',
    );
    expect(moveGermanySpoke('/en/vehicle-import/de')).toBe(
      '/en/vehicle-import/eu/de/',
    );
  });

  it('chains after a slug rename, so very old /privoz/de/ links reach the new path in one hop', () => {
    const renamed = renameSlugSegments('/privoz/de/');
    expect(renamed).toBe('/vehicle-import/de/');
    expect(moveGermanySpoke(renamed!)).toBe('/vehicle-import/eu/de/');
  });
});

describe('movedBrandUrl', () => {
  it('lands a service hub on the brand services page, not its home', () => {
    expect(movedBrandUrl('/ru/auto-service-belgrade/')).toBe(
      'https://carlab.rs/ru/services/',
    );
    expect(movedBrandUrl('/sr/detailing-belgrade/')).toBe(
      'https://details.rs/sr/services/',
    );
  });

  it('keeps the case slug, which moved across unchanged', () => {
    expect(movedBrandUrl('/ru/auto-service-belgrade/bmw-x3/')).toBe(
      'https://carlab.rs/ru/works/bmw-x3/',
    );
  });

  it('redirects the pre-rename wrapping slug to the detailing brand', () => {
    expect(movedBrandUrl('/ru/wrapping-belgrade/')).toBe(
      'https://details.rs/ru/services/',
    );
    expect(movedBrandUrl('/ru/wrapping-belgrade/bmw-x5/')).toBe(
      'https://details.rs/ru/works/bmw-x5/',
    );
  });

  it('falls back to en for locales the brand sites do not run', () => {
    expect(movedBrandUrl('/de/detailing-belgrade/bmw-x5/')).toBe(
      'https://details.rs/en/works/bmw-x5/',
    );
  });

  it('treats an unprefixed path as ru', () => {
    expect(movedBrandUrl('/avtoservis-belgrade/')).toBe(
      'https://carlab.rs/ru/services/',
    );
  });

  it('sends a case-tab URL to the brand site works listing', () => {
    expect(movedBrandUrl('/en/cases/auto-service')).toBe(
      'https://carlab.rs/en/works/',
    );
    expect(movedBrandUrl('/cases/detailing')).toBe(
      'https://details.rs/ru/works/',
    );
  });

  it('leaves every path that did not move alone', () => {
    expect(movedBrandUrl('/ru/vehicle-sourcing/de/')).toBeNull();
    expect(movedBrandUrl('/ru/cases/vehicle-import/')).toBeNull();
    expect(movedBrandUrl('/')).toBeNull();
  });

  it('does not read an inherited Object property as a moved host', () => {
    expect(movedBrandUrl('/ru/constructor/')).toBeNull();
    expect(movedBrandUrl('/ru/cases/toString/')).toBeNull();
  });
});

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
      '/en/vehicle-sourcing/de/?ref=x',
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

describe('vercel.json brand redirects', () => {
  const BRAND_HOSTS = ['carlab.rs', 'details.rs'];
  const SLUG = 'bmw-x3';

  interface Redirect {
    source: string;
    destination: string;
  }

  function localesOf(source: string): string[] {
    const group = /:locale\(([^)]+)\)/.exec(source);
    return group ? group[1]!.split('|') : ['ru'];
  }

  function fill(pattern: string, locale: string): string {
    return pattern
      .replace(/:locale\([^)]+\)/, locale)
      .replace(':locale', locale)
      .replace(':slug+', SLUG);
  }

  const redirects: Redirect[] = (
    JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
      .redirects as Redirect[]
  ).filter((entry) =>
    BRAND_HOSTS.some((host) => entry.destination.includes(host)),
  );

  const cases = redirects.flatMap((entry) =>
    localesOf(entry.source).map(
      (locale) =>
        [fill(entry.source, locale), fill(entry.destination, locale)] as const,
    ),
  );

  it('finds the brand rules to check', () => {
    expect(cases.length).toBeGreaterThan(60);
  });

  it.each(cases)('sends %s where the middleware sends it', (path, target) => {
    expect(movedBrandUrl(path)).toBe(target);
  });
});
