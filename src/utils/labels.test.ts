import { describe, it, expect } from 'vitest';
import { getNavItems, isNavItemActive } from './labels';

describe('getNavItems', () => {
  it('orders Автоподбор first, Автосервис second, then the rest of SERVICES', () => {
    const result = getNavItems('ru', 'de');
    expect(result.map(i => i.label)).toEqual(['Автоподбор', 'Автосервис', 'Выкуп', 'Проверка']);
  });

  it('builds per-locale, per-country hrefs for country-scoped items and a fixed href for Автосервис', () => {
    const result = getNavItems('ru', 'rs');
    expect(result).toEqual([
      { href: '/ru/rs/autopodbor/', label: 'Автоподбор', slug: 'autopodbor' },
      { href: '/ru/avtoservis-belgrade/', label: 'Автосервис', slug: 'autoservice' },
      { href: '/ru/rs/vykup/', label: 'Выкуп', slug: 'vykup' },
      { href: '/ru/rs/proverka/', label: 'Проверка', slug: 'proverka' },
    ]);
  });

  it('every slug has an icon mapping in Header.astro\'s SERVICE_ICONS', () => {
    const knownSlugs = ['autopodbor', 'autoservice', 'vykup', 'proverka'];
    getNavItems('ru', 'de').forEach(item => expect(knownSlugs).toContain(item.slug));
  });
});

describe('isNavItemActive', () => {
  const autopodbor = { href: '/ru/de/autopodbor/' };
  const autoservice = { href: '/ru/avtoservis-belgrade/' };

  it('matches a country-scoped item on its exact path', () => {
    expect(isNavItemActive(autopodbor, 'ru', 'de', '/ru/de/autopodbor/')).toBe(true);
  });

  it('matches a country-scoped item nested under a city segment', () => {
    expect(isNavItemActive(autopodbor, 'ru', 'de', '/ru/de/berlin/autopodbor/')).toBe(true);
  });

  it('does not false-match an unrelated route sharing the same slug', () => {
    expect(isNavItemActive(autopodbor, 'ru', 'de', '/ru/cases/autopodbor/')).toBe(false);
  });

  it('does not match when the leading country segment differs', () => {
    expect(isNavItemActive(autopodbor, 'ru', 'de', '/ru/rs/autopodbor/')).toBe(false);
  });

  it('does not match when the locale segment differs', () => {
    expect(isNavItemActive(autopodbor, 'ru', 'de', '/en/de/autopodbor/')).toBe(false);
  });

  it('matches a fixed (non-country-scoped) item by prefix', () => {
    expect(isNavItemActive(autoservice, 'ru', 'de', '/ru/avtoservis-belgrade/bmw-x1/')).toBe(true);
  });
});
