import { describe, it, expect } from 'vitest';
import {
  getNavItems,
  isNavItemActive,
  isCountryScopedServiceSlug,
  SERVICE_SLUGS,
} from './labels';

describe('getNavItems', () => {
  it('orders Автоподбор first, Привоз second, Автосервис third, Детейлинг fourth, then the rest of SERVICES', () => {
    const result = getNavItems('ru', 'de');
    expect(result.map((i) => i.label)).toEqual([
      'Автоподбор',
      'Авто из ЕС и Китая',
      'Автосервис',
      'Детейлинг',
      'Выкуп',
      'Проверка',
    ]);
  });

  it('builds per-locale, per-country hrefs for Выкуп/Проверка, fixed hub hrefs for Автоподбор/Привоз/Автосервис/Детейлинг', () => {
    const result = getNavItems('ru', 'rs');
    expect(result).toEqual([
      {
        href: '/ru/vehicle-sourcing/',
        label: 'Автоподбор',
        slug: 'vehicle-sourcing',
      },
      {
        href: '/ru/vehicle-import/',
        label: 'Авто из ЕС и Китая',
        slug: 'vehicle-import',
      },
      {
        href: '/ru/auto-service-belgrade/',
        label: 'Автосервис',
        slug: 'auto-service-belgrade',
      },
      {
        href: '/ru/detailing-belgrade/',
        label: 'Детейлинг',
        slug: 'detailing-belgrade',
      },
      {
        href: '/ru/vehicle-buyback/rs/',
        label: 'Выкуп',
        slug: 'vehicle-buyback',
      },
      {
        href: '/ru/vehicle-inspection/rs/',
        label: 'Проверка',
        slug: 'vehicle-inspection',
      },
    ]);
  });

  it("every slug is covered by SERVICE_SLUGS (Header.astro's SERVICE_ICONS is typed against this exact union, so a mismatch is a compile error there too)", () => {
    getNavItems('ru', 'de').forEach((item) =>
      expect(SERVICE_SLUGS as readonly string[]).toContain(item.slug),
    );
  });
});

describe('isNavItemActive', () => {
  const sourcing = { href: '/ru/vehicle-sourcing/', slug: 'vehicle-sourcing' };
  const autoservice = {
    href: '/ru/auto-service-belgrade/',
    slug: 'auto-service-belgrade',
  };

  it('matches a country-scoped item on its exact path', () => {
    expect(
      isNavItemActive(sourcing, 'ru', 'de', '/ru/vehicle-sourcing/de/'),
    ).toBe(true);
  });

  it('matches a country-scoped item nested under a city segment', () => {
    expect(
      isNavItemActive(sourcing, 'ru', 'de', '/ru/vehicle-sourcing/de/berlin/'),
    ).toBe(true);
  });

  it('matches the bare hub page regardless of navCountry', () => {
    expect(isNavItemActive(sourcing, 'ru', 'de', '/ru/vehicle-sourcing/')).toBe(
      true,
    );
  });

  it('does not false-match an unrelated route sharing the same slug', () => {
    expect(
      isNavItemActive(sourcing, 'ru', 'de', '/ru/cases/vehicle-sourcing/'),
    ).toBe(false);
  });

  it('does not match when the country segment differs', () => {
    expect(
      isNavItemActive(sourcing, 'ru', 'de', '/ru/vehicle-sourcing/rs/'),
    ).toBe(false);
  });

  it('does not match when the locale segment differs', () => {
    expect(
      isNavItemActive(sourcing, 'ru', 'de', '/en/vehicle-sourcing/de/'),
    ).toBe(false);
  });

  it('matches a fixed (non-country-scoped) item by prefix', () => {
    expect(
      isNavItemActive(
        autoservice,
        'ru',
        'de',
        '/ru/auto-service-belgrade/bmw-x1/',
      ),
    ).toBe(true);
  });
});

describe('isCountryScopedServiceSlug', () => {
  it('is true for the 3 services with a [country] route', () => {
    expect(isCountryScopedServiceSlug('vehicle-sourcing')).toBe(true);
    expect(isCountryScopedServiceSlug('vehicle-buyback')).toBe(true);
    expect(isCountryScopedServiceSlug('vehicle-inspection')).toBe(true);
  });

  it('is false for services without a [country] route', () => {
    expect(isCountryScopedServiceSlug('vehicle-import')).toBe(false);
    expect(isCountryScopedServiceSlug('auto-service-belgrade')).toBe(false);
    expect(isCountryScopedServiceSlug('detailing-belgrade')).toBe(false);
  });
});
