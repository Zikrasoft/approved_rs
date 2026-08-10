import { describe, it, expect } from 'vitest';
import { getNavItems, isNavItemActive, SERVICE_ICON_SLUGS } from './labels';

describe('getNavItems', () => {
  it('orders Автоподбор first, Привоз second, Автосервис third, then the rest of SERVICES', () => {
    const result = getNavItems('ru', 'de');
    expect(result.map(i => i.label)).toEqual(['Автоподбор', 'Привоз авто', 'Автосервис', 'Выкуп', 'Проверка']);
  });

  it('builds per-locale, per-country hrefs for country-scoped items and fixed hrefs for Привоз/Автосервис', () => {
    const result = getNavItems('ru', 'rs');
    expect(result).toEqual([
      { href: '/ru/autopodbor/rs/', label: 'Автоподбор', slug: 'autopodbor' },
      { href: '/ru/privoz/', label: 'Привоз авто', slug: 'privoz' },
      { href: '/ru/avtoservis-belgrade/', label: 'Автосервис', slug: 'autoservice' },
      { href: '/ru/vykup/rs/', label: 'Выкуп', slug: 'vykup' },
      { href: '/ru/proverka/rs/', label: 'Проверка', slug: 'proverka' },
    ]);
  });

  it('every slug is covered by SERVICE_ICON_SLUGS (Header.astro\'s SERVICE_ICONS is typed against this exact union, so a mismatch is a compile error there too)', () => {
    getNavItems('ru', 'de').forEach(item => expect(SERVICE_ICON_SLUGS as readonly string[]).toContain(item.slug));
  });
});

describe('isNavItemActive', () => {
  const autopodbor = { href: '/ru/autopodbor/de/', slug: 'autopodbor' };
  const autoservice = { href: '/ru/avtoservis-belgrade/', slug: 'autoservice' };

  it('matches a country-scoped item on its exact path', () => {
    expect(isNavItemActive(autopodbor, 'ru', 'de', '/ru/autopodbor/de/')).toBe(true);
  });

  it('matches a country-scoped item nested under a city segment', () => {
    expect(isNavItemActive(autopodbor, 'ru', 'de', '/ru/autopodbor/de/berlin/')).toBe(true);
  });

  it('does not false-match an unrelated route sharing the same slug', () => {
    expect(isNavItemActive(autopodbor, 'ru', 'de', '/ru/cases/autopodbor/')).toBe(false);
  });

  it('does not match when the country segment differs', () => {
    expect(isNavItemActive(autopodbor, 'ru', 'de', '/ru/autopodbor/rs/')).toBe(false);
  });

  it('does not match when the locale segment differs', () => {
    expect(isNavItemActive(autopodbor, 'ru', 'de', '/en/autopodbor/de/')).toBe(false);
  });

  it('matches a fixed (non-country-scoped) item by prefix', () => {
    expect(isNavItemActive(autoservice, 'ru', 'de', '/ru/avtoservis-belgrade/bmw-x1/')).toBe(true);
  });
});
