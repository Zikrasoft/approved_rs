import { describe, it, expect } from 'vitest';
import { getNavItems, isNavItemActive } from './labels';

describe('getNavItems', () => {
  it('orders Автоподбор first, Автосервис second, then the rest of SERVICES', () => {
    const result = getNavItems('de');
    expect(result.map(i => i.label)).toEqual(['Автоподбор', 'Автосервис', 'Выкуп', 'Проверка']);
  });

  it('builds per-country hrefs for country-scoped items and a fixed href for Автосервис', () => {
    const result = getNavItems('rs');
    expect(result).toEqual([
      { href: '/rs/autopodbor/', label: 'Автоподбор' },
      { href: '/avtoservis-belgrade/', label: 'Автосервис' },
      { href: '/rs/vykup/', label: 'Выкуп' },
      { href: '/rs/proverka/', label: 'Проверка' },
    ]);
  });
});

describe('isNavItemActive', () => {
  const autopodbor = { href: '/de/autopodbor/' };
  const autoservice = { href: '/avtoservis-belgrade/' };

  it('matches a country-scoped item on its exact path', () => {
    expect(isNavItemActive(autopodbor, 'de', '/de/autopodbor/')).toBe(true);
  });

  it('matches a country-scoped item nested under a city segment', () => {
    expect(isNavItemActive(autopodbor, 'de', '/de/berlin/autopodbor/')).toBe(true);
  });

  it('does not false-match an unrelated route sharing the same slug', () => {
    expect(isNavItemActive(autopodbor, 'de', '/cases/autopodbor/')).toBe(false);
  });

  it('does not match when the leading segment is a different country', () => {
    expect(isNavItemActive(autopodbor, 'de', '/rs/autopodbor/')).toBe(false);
  });

  it('matches a fixed (non-country-scoped) item by prefix', () => {
    expect(isNavItemActive(autoservice, 'de', '/avtoservis-belgrade/bmw-x1/')).toBe(true);
  });
});
