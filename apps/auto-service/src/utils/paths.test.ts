import { describe, it, expect } from 'vitest';
import { PathBuilder, swapLocale, vehiclePath, withLocales } from './paths';
import { SERVICE_SLUGS } from './services';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('vehiclePath', () => {
  const vehicle = {
    id: 'veh_1',
    slug: 'b47d20o0-140kw',
    model: {
      slug: '3-series-f30-320d',
      chassis: { series: { make: { slug: 'bmw' } } },
    },
  };

  it.each(SUPPORTED_LOCALES)(
    'puts a %s Vehicle page under its Model',
    (locale) => {
      expect(vehiclePath(locale, vehicle)).toBe(
        `/${locale}/parts/bmw/3-series-f30-320d/m/b47d20o0-140kw/`,
      );
    },
  );

  it('falls back to the id for a shop that has not shipped Vehicle slugs', () => {
    expect(vehiclePath('sr', { ...vehicle, slug: null })).toBe(
      '/sr/parts/bmw/3-series-f30-320d/m/veh_1/',
    );
  });
});

describe('PathBuilder', () => {
  it('prefixes every path with the locale and ends with a slash', () => {
    const paths = [
      PathBuilder.home('sr'),
      PathBuilder.services('sr'),
      PathBuilder.service('sr', 'diagnostics'),
      PathBuilder.works('sr'),
      PathBuilder.work('sr', 'bmw-x5'),
      PathBuilder.contact('sr'),
      PathBuilder.thanks('sr'),
      PathBuilder.privacy('sr'),
      PathBuilder.about('sr'),
      PathBuilder.bmw('sr'),
    ];
    paths.forEach((path) => {
      expect(path.startsWith('/sr/')).toBe(true);
      expect(path.endsWith('/')).toBe(true);
    });
  });

  it.each(SERVICE_SLUGS)('builds a service URL for %s', (slug) => {
    expect(PathBuilder.service('ru', slug)).toBe(`/ru/services/${slug}/`);
  });

  it.each(SUPPORTED_LOCALES)(
    'puts a %s Category page past the first under its number',
    (locale) => {
      expect(PathBuilder.partsCategory(locale, 'oil-filters')).toBe(
        `/${locale}/parts/c/oil-filters/`,
      );
      expect(PathBuilder.partsCategory(locale, 'oil-filters', 1)).toBe(
        `/${locale}/parts/c/oil-filters/`,
      );
      expect(PathBuilder.partsCategory(locale, 'oil-filters', 2)).toBe(
        `/${locale}/parts/c/oil-filters/2/`,
      );
    },
  );
});

describe('swapLocale', () => {
  it('replaces the locale segment and keeps the rest of the path', () => {
    expect(swapLocale('/ru/works/bmw-x5/', 'en')).toBe('/en/works/bmw-x5/');
  });

  it('maps a bare locale root to the other locale root', () => {
    expect(swapLocale('/ru/', 'sr')).toBe('/sr/');
  });

  it('handles a path with no trailing slash', () => {
    expect(swapLocale('/ru/contact', 'en')).toBe('/en/contact/');
  });

  it('never produces a doubled locale prefix', () => {
    const swapped = swapLocale('/en/works/bmw/', 'ru');
    expect(swapped).toBe('/ru/works/bmw/');
    expect(swapped.split('/').filter(Boolean)[0]).toBe('ru');
  });
});

describe('withLocales', () => {
  it('fans one path set out across every supported locale', () => {
    const paths = withLocales([{ params: { slug: 'a' } }]);
    expect(paths).toHaveLength(SUPPORTED_LOCALES.length);
    expect(paths.map((p) => p.params.locale).sort()).toEqual(
      [...SUPPORTED_LOCALES].sort(),
    );
    paths.forEach((p) => expect(p.params.slug).toBe('a'));
  });
});
