import { describe, it, expect } from 'vitest';
import {
  getNavItems,
  isCountryScopedServiceSlug,
  SERVICE_SLUGS,
} from './labels';

describe('getNavItems', () => {
  it('orders Автоподбор first, Привоз second, then the rest of SERVICES', () => {
    const result = getNavItems('ru');
    expect(result.map((i) => i.label)).toEqual([
      'Автоподбор',
      'Авто из Европы и Китая',
      'Выкуп',
      'Проверка',
    ]);
  });

  it('points every service at its own hub, not at a country page', () => {
    const result = getNavItems('ru');
    expect(result).toEqual([
      {
        href: '/ru/vehicle-sourcing/',
        label: 'Автоподбор',
        slug: 'vehicle-sourcing',
      },
      {
        href: '/ru/vehicle-import/',
        label: 'Авто из Европы и Китая',
        slug: 'vehicle-import',
      },
      {
        href: '/ru/vehicle-buyback/',
        label: 'Выкуп',
        slug: 'vehicle-buyback',
      },
      {
        href: '/ru/vehicle-inspection/',
        label: 'Проверка',
        slug: 'vehicle-inspection',
      },
    ]);
  });

  it("every slug is covered by SERVICE_SLUGS (Header.astro's SERVICE_ICONS is typed against this exact union, so a mismatch is a compile error there too)", () => {
    getNavItems('ru').forEach((item) =>
      expect(SERVICE_SLUGS as readonly string[]).toContain(item.slug),
    );
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
  });
});
