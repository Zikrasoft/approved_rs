import { describe, it, expect, vi } from 'vitest';

// middleware.ts imports Astro's virtual modules, only resolvable inside
// Astro's own build pipeline, not in this project's plain-Node vitest
// config — mocked here (same technique as llmsTxt.test.ts's astro:content
// mock) rather than pulling Astro's Vite plugin into the test config for
// the one pure function (renameSlugSegments) this file actually exercises.
vi.mock('astro:middleware', () => ({ defineMiddleware: (fn: unknown) => fn }));
vi.mock('astro:i18n', () => ({ requestHasLocale: () => false }));

const { renameSlugSegments, moveGermanySpoke, movedBrandUrl } =
  await import('./middleware');

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
  it('sends a service hub to the brand site that owns it now', () => {
    expect(movedBrandUrl('/ru/auto-service-belgrade/')).toBe(
      'https://autohub.rs/ru/',
    );
    expect(movedBrandUrl('/sr/detailing-belgrade/')).toBe(
      'https://prizma.rs/sr/',
    );
  });

  it('keeps the case slug, which moved across unchanged', () => {
    expect(movedBrandUrl('/ru/auto-service-belgrade/bmw-x3/')).toBe(
      'https://autohub.rs/ru/works/bmw-x3/',
    );
  });

  it('falls back to en for locales the brand sites do not run', () => {
    expect(movedBrandUrl('/de/detailing-belgrade/bmw-x5/')).toBe(
      'https://prizma.rs/en/works/bmw-x5/',
    );
  });

  it('treats an unprefixed path as ru', () => {
    expect(movedBrandUrl('/avtoservis-belgrade/')).toBe(
      'https://autohub.rs/ru/',
    );
  });

  it('sends a case-tab URL to the brand site works listing', () => {
    expect(movedBrandUrl('/en/cases/auto-service')).toBe(
      'https://autohub.rs/en/works/',
    );
    expect(movedBrandUrl('/cases/detailing')).toBe(
      'https://prizma.rs/ru/works/',
    );
  });

  it('leaves every path that did not move alone', () => {
    expect(movedBrandUrl('/ru/vehicle-sourcing/de/')).toBeNull();
    expect(movedBrandUrl('/ru/cases/vehicle-import/')).toBeNull();
    expect(movedBrandUrl('/')).toBeNull();
  });
});
