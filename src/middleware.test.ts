import { describe, it, expect, vi } from 'vitest';

// middleware.ts imports Astro's virtual modules, only resolvable inside
// Astro's own build pipeline, not in this project's plain-Node vitest
// config — mocked here (same technique as llmsTxt.test.ts's astro:content
// mock) rather than pulling Astro's Vite plugin into the test config for
// the one pure function (renameSlugSegments) this file actually exercises.
vi.mock('astro:middleware', () => ({ defineMiddleware: (fn: unknown) => fn }));
vi.mock('astro:i18n', () => ({ requestHasLocale: () => false }));

const { renameSlugSegments, moveGermanySpoke } = await import('./middleware');

describe('renameSlugSegments', () => {
  it('renames a single old service-slug segment', () => {
    expect(renameSlugSegments('/autopodbor/de/')).toBe('/vehicle-sourcing/de/');
  });

  it('renames only the matching segment, preserving the locale prefix', () => {
    expect(renameSlugSegments('/en/autopodbor/de/')).toBe('/en/vehicle-sourcing/de/');
  });

  it('renames every old slug to its new equivalent', () => {
    expect(renameSlugSegments('/privoz/')).toBe('/vehicle-import/');
    expect(renameSlugSegments('/vykup/de/')).toBe('/vehicle-buyback/de/');
    expect(renameSlugSegments('/proverka/de/')).toBe('/vehicle-inspection/de/');
    expect(renameSlugSegments('/avtoservis-belgrade/')).toBe('/auto-service-belgrade/');
    expect(renameSlugSegments('/cases/autoservice/')).toBe('/cases/auto-service/');
  });

  it('returns null when no segment matches (no redirect needed)', () => {
    expect(renameSlugSegments('/en/vehicle-sourcing/de/')).toBeNull();
    expect(renameSlugSegments('/contacts/')).toBeNull();
  });

  it('chains correctly after LEGACY_PATH_REWRITES output', () => {
    // '/cases/' rewrites to '/cases/autopodbor' in LEGACY_PATH_REWRITES,
    // which must then still get slug-renamed to the current route.
    expect(renameSlugSegments('/cases/autopodbor')).toBe('/cases/vehicle-sourcing');
    // Same for the old country-first pages: '/rs/autopodbor/' rewrites to
    // '/autopodbor/rs' in LEGACY_PATH_REWRITES, which then still needs renaming.
    expect(renameSlugSegments('/autopodbor/rs')).toBe('/vehicle-sourcing/rs');
  });
});

describe('moveGermanySpoke', () => {
  it('nests the old Germany spoke path under /eu/', () => {
    expect(moveGermanySpoke('/vehicle-import/de/')).toBe('/vehicle-import/eu/de/');
    expect(moveGermanySpoke('/en/vehicle-import/de/')).toBe('/en/vehicle-import/eu/de/');
  });

  it('returns null for unrelated paths', () => {
    expect(moveGermanySpoke('/en/vehicle-sourcing/de/')).toBeNull();
    expect(moveGermanySpoke('/en/vehicle-import/eu/')).toBeNull();
  });

  it('matches even without a trailing slash (trailingSlash is "ignore")', () => {
    expect(moveGermanySpoke('/vehicle-import/de')).toBe('/vehicle-import/eu/de/');
    expect(moveGermanySpoke('/en/vehicle-import/de')).toBe('/en/vehicle-import/eu/de/');
  });

  it('chains after a slug rename, so very old /privoz/de/ links reach the new path in one hop', () => {
    const renamed = renameSlugSegments('/privoz/de/');
    expect(renamed).toBe('/vehicle-import/de/');
    expect(moveGermanySpoke(renamed!)).toBe('/vehicle-import/eu/de/');
  });
});
