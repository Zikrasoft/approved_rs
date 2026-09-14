import { describe, it, expect } from 'vitest';
import { PathBuilder, swapLocale, withLocales } from './paths';
import { SERVICE_SLUGS } from './services';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('PathBuilder', () => {
  it('prefixes every path with the locale and ends with a slash', () => {
    const paths = [
      PathBuilder.home('sr'),
      PathBuilder.services('sr'),
      PathBuilder.service('sr', 'diagnostics'),
      PathBuilder.works('sr'),
      PathBuilder.work('sr', 'bmw-x5'),
      PathBuilder.shop('sr'),
      PathBuilder.product('sr', 'battery-60'),
      PathBuilder.cart('sr'),
      PathBuilder.contact('sr'),
      PathBuilder.thanks('sr'),
      PathBuilder.privacy('sr'),
    ];
    paths.forEach((path) => {
      expect(path.startsWith('/sr/')).toBe(true);
      expect(path.endsWith('/')).toBe(true);
    });
  });

  it.each(SERVICE_SLUGS)('builds a service URL for %s', (slug) => {
    expect(PathBuilder.service('ru', slug)).toBe(`/ru/services/${slug}/`);
  });
});

describe('swapLocale', () => {
  it('replaces the locale segment and keeps the rest of the path', () => {
    expect(swapLocale('/ru/shop/battery-60/', 'en')).toBe(
      '/en/shop/battery-60/',
    );
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
