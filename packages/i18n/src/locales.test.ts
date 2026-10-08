import { describe, it, expect } from 'vitest';
import { createLocaleSet, SOURCE_LOCALE } from './locales.ts';

const OG_LOCALE = {
  ru: 'ru_RU',
  en: 'en_US',
  sr: 'sr_RS',
  es: 'es_ES',
  de: 'de_DE',
};

const OG_SUFFIX = { ru: '', en: '-en', sr: '-sr', es: '-es', de: '-de' };

const set = createLocaleSet({
  locales: ['ru', 'en', 'sr', 'es', 'de'] as const,
  primaryLocale: 'ru',
  ogLocale: OG_LOCALE,
  ogSuffix: OG_SUFFIX,
});

const srFirst = createLocaleSet({
  locales: ['ru', 'sr', 'en'] as const,
  primaryLocale: 'sr',
  ogLocale: OG_LOCALE,
  ogSuffix: OG_SUFFIX,
});

describe('createLocaleSet options', () => {
  it('rejects an empty locale list', () => {
    expect(() =>
      createLocaleSet({
        locales: [] as const,
        // @ts-expect-error an empty list leaves no valid primary
        primaryLocale: 'ru',
        ogLocale: {},
        ogSuffix: {},
      }),
    ).toThrow('locales must not be empty');
  });

  it('rejects a primary locale that is not one of the locales', () => {
    expect(() =>
      createLocaleSet({
        locales: ['ru', 'en'] as const,
        // @ts-expect-error the primary must be one of the locales
        primaryLocale: 'de',
        ogLocale: OG_LOCALE,
        ogSuffix: OG_SUFFIX,
      }),
    ).toThrow('primaryLocale "de" is not in the locale list');
  });

  it('rejects a locale list that cannot hold the translation source', () => {
    expect(() =>
      createLocaleSet({
        locales: ['sr', 'en'] as const,
        primaryLocale: 'sr',
        ogLocale: OG_LOCALE,
        ogSuffix: OG_SUFFIX,
      }),
    ).toThrow(`SOURCE_LOCALE "${SOURCE_LOCALE}" is not in the locale list`);
  });

  it('rejects an og locale map that misses a locale', () => {
    expect(() =>
      createLocaleSet({
        locales: ['ru', 'sr', 'en'] as const,
        primaryLocale: 'ru',
        // @ts-expect-error the map must cover every locale
        ogLocale: { ru: 'ru_RU' },
        ogSuffix: OG_SUFFIX,
      }),
    ).toThrow('ogLocale has no entry for sr, en');
  });

  it('rejects an og suffix map that misses a locale', () => {
    expect(() =>
      createLocaleSet({
        locales: ['ru', 'sr', 'en'] as const,
        primaryLocale: 'ru',
        ogLocale: OG_LOCALE,
        // @ts-expect-error the map must cover every locale
        ogSuffix: { ru: '', en: '-en' },
      }),
    ).toThrow('ogSuffix has no entry for sr');
  });
});

describe('PRIMARY_LOCALE', () => {
  it('is the routing default, independent of the translation source', () => {
    expect(set.PRIMARY_LOCALE).toBe('ru');
    expect(srFirst.PRIMARY_LOCALE).toBe('sr');
  });
});

describe('TRANSLATABLE_LOCALES', () => {
  it('is every locale except the source language', () => {
    expect(set.TRANSLATABLE_LOCALES).toEqual(['en', 'sr', 'es', 'de']);
  });

  it('follows the configured locale list rather than a fixed one', () => {
    const small = createLocaleSet({
      locales: ['ru', 'sr'] as const,
      primaryLocale: 'ru',
      ogLocale: OG_LOCALE,
      ogSuffix: OG_SUFFIX,
    });

    expect(small.TRANSLATABLE_LOCALES).toEqual(['sr']);
  });

  it('still excludes only the source language when the primary is another one', () => {
    expect(srFirst.TRANSLATABLE_LOCALES).toEqual(['sr', 'en']);
  });
});

describe('isLocale', () => {
  it('accepts a supported locale', () => {
    expect(set.isLocale('sr')).toBe(true);
  });

  it('rejects anything else, including near-misses', () => {
    expect(set.isLocale('sr-RS')).toBe(false);
    expect(set.isLocale('')).toBe(false);
    expect(set.isLocale('constructor')).toBe(false);
  });
});

describe('getLocale', () => {
  it('passes a known locale through', () => {
    expect(set.getLocale('en')).toBe('en');
  });

  it('falls back to the primary locale when the caller has none', () => {
    expect(set.getLocale(undefined)).toBe('ru');
    expect(srFirst.getLocale(undefined)).toBe('sr');
  });

  it('falls back to the primary locale for a value outside the set', () => {
    expect(set.getLocale('en-GB')).toBe('ru');
    expect(srFirst.getLocale('')).toBe('sr');
  });
});

describe('localeFrom', () => {
  it.each(['ru', 'en', 'sr', 'es', 'de'] as const)(
    'reads %s off the first path segment',
    (locale) => {
      expect(set.localeFrom(`/${locale}/services/`)).toBe(locale);
    },
  );

  it('works for a bare locale root', () => {
    expect(srFirst.localeFrom('/en/')).toBe('en');
  });

  it('falls back to the primary locale at the site root', () => {
    expect(set.localeFrom('/')).toBe('ru');
    expect(srFirst.localeFrom('/')).toBe('sr');
  });

  it('falls back to the primary locale outside the [locale] tree', () => {
    expect(srFirst.localeFrom('/404')).toBe('sr');
  });

  it('falls back to the primary locale for an unsupported language', () => {
    expect(srFirst.localeFrom('/zh/services/')).toBe('sr');
  });

  it('falls back to the primary locale for a prototype key', () => {
    expect(srFirst.localeFrom('/constructor/')).toBe('sr');
  });
});

describe('detectLocale', () => {
  it('prefers the cookie over the browser header', () => {
    expect(set.detectLocale('de,en;q=0.9', 'sr')).toBe('sr');
  });

  it('ignores a cookie holding an unsupported locale', () => {
    expect(set.detectLocale('de', 'zz')).toBe('de');
  });

  it('falls back to the primary locale with no header and no cookie', () => {
    expect(set.detectLocale(null, undefined)).toBe('ru');
    expect(srFirst.detectLocale(null, undefined)).toBe('sr');
  });

  it('picks the highest-q supported language, not the first listed', () => {
    expect(set.detectLocale('fr;q=0.9,de;q=1.0', undefined)).toBe('de');
  });

  it('honours q=0 as a refusal rather than a weak preference', () => {
    expect(set.detectLocale('fr,sr;q=0', undefined)).toBe('ru');
  });

  it('treats an unparseable q as a refusal instead of ranking on NaN', () => {
    expect(set.detectLocale('sr;q=x,en', undefined)).toBe('en');
  });

  it('matches on the primary subtag, so en-GB counts as en', () => {
    expect(set.detectLocale('en-GB', undefined)).toBe('en');
  });

  it('skips languages the site does not serve', () => {
    expect(set.detectLocale('fr,it,sr', undefined)).toBe('sr');
  });

  it('falls back to the primary locale when no listed language is served', () => {
    expect(set.detectLocale('fr,it', undefined)).toBe('ru');
    expect(srFirst.detectLocale('fr,it', undefined)).toBe('sr');
  });
});

describe('headLinks', () => {
  it('builds canonical, alternates and og:locale for a page', () => {
    expect(
      set.headLinks('https://approved.rs', 'en', '/en/vehicle-import/de/'),
    ).toEqual({
      canonical: 'https://approved.rs/en/vehicle-import/de/',
      alternates: [
        { hreflang: 'ru', href: 'https://approved.rs/ru/vehicle-import/de/' },
        { hreflang: 'en', href: 'https://approved.rs/en/vehicle-import/de/' },
        { hreflang: 'sr', href: 'https://approved.rs/sr/vehicle-import/de/' },
        { hreflang: 'es', href: 'https://approved.rs/es/vehicle-import/de/' },
        { hreflang: 'de', href: 'https://approved.rs/de/vehicle-import/de/' },
        {
          hreflang: 'x-default',
          href: 'https://approved.rs/ru/vehicle-import/de/',
        },
      ],
      ogLocale: 'en_US',
      ogImage: 'https://approved.rs/og-en.png',
    });
  });

  it('points x-default at the primary locale, not the translation source', () => {
    const head = srFirst.headLinks('https://details.rs', 'ru', '/ru/works/');

    expect(head.alternates.at(-1)).toEqual({
      hreflang: 'x-default',
      href: 'https://details.rs/sr/works/',
    });
  });

  it('defaults the og image to the locale one and keeps a supplied one', () => {
    expect(set.headLinks('https://approved.rs', 'ru', '/ru/').ogImage).toBe(
      'https://approved.rs/og.png',
    );
    expect(
      set.headLinks('https://approved.rs', 'ru', '/ru/', 'https://x/y.png')
        .ogImage,
    ).toBe('https://x/y.png');
  });

  it('points the bare site root at the locale homepage', () => {
    const head = srFirst.headLinks('https://details.rs', 'ru', '/');

    expect(head.canonical).toBe('https://details.rs/ru/');
    expect(head.alternates[0]).toEqual({
      hreflang: 'ru',
      href: 'https://details.rs/ru/',
    });
  });

  it('keeps the 404 page on its own canonical', () => {
    const head = srFirst.headLinks('https://details.rs', 'sr', '/404/');

    expect(head.canonical).toBe('https://details.rs/404/');
    expect(head.alternates.at(-1)).toEqual({
      hreflang: 'x-default',
      href: 'https://details.rs/sr/',
    });
  });
});
