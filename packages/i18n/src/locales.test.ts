import { describe, it, expect } from 'vitest';
import { createLocaleSet } from './locales.ts';

const set = createLocaleSet({
  locales: ['ru', 'en', 'sr', 'es', 'de'] as const,
  defaultLocale: 'ru',
});

describe('createLocaleSet options', () => {
  it('rejects an empty locale list', () => {
    expect(() =>
      // @ts-expect-error an empty list leaves no valid default — caught at
      // compile time too, this pins the runtime guard for untyped callers.
      createLocaleSet({ locales: [] as const, defaultLocale: 'ru' }),
    ).toThrow('locales must not be empty');
  });

  it('rejects a default that is not one of the locales', () => {
    expect(() =>
      // @ts-expect-error same guard, one layer down from the type system.
      createLocaleSet({ locales: ['ru', 'en'] as const, defaultLocale: 'de' }),
    ).toThrow('is not in the locale list');
  });
});

describe('TRANSLATABLE_LOCALES', () => {
  it('is every locale except the source language', () => {
    expect(set.TRANSLATABLE_LOCALES).toEqual(['en', 'sr', 'es', 'de']);
  });

  it('follows the configured locale list rather than a fixed one', () => {
    const small = createLocaleSet({
      locales: ['ru', 'sr'] as const,
      defaultLocale: 'ru',
    });

    expect(small.TRANSLATABLE_LOCALES).toEqual(['sr']);
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

  it('falls back to the default when the caller has none', () => {
    expect(set.getLocale(undefined)).toBe('ru');
  });
});

describe('detectLocale', () => {
  it('prefers the cookie over the browser header', () => {
    expect(set.detectLocale('de,en;q=0.9', 'sr')).toBe('sr');
  });

  it('ignores a cookie holding an unsupported locale', () => {
    expect(set.detectLocale('de', 'zz')).toBe('de');
  });

  it('falls back to the default with no header and no cookie', () => {
    expect(set.detectLocale(null, undefined)).toBe('ru');
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

  it('falls back to the default when no listed language is served', () => {
    expect(set.detectLocale('fr,it', undefined)).toBe('ru');
  });
});

describe('getAlternateLinks', () => {
  it('lists every locale plus x-default for the site root', () => {
    const links = set.getAlternateLinks('https://approved.rs', '/ru/');

    expect(links).toEqual([
      { hreflang: 'ru', href: 'https://approved.rs/ru/' },
      { hreflang: 'en', href: 'https://approved.rs/en/' },
      { hreflang: 'sr', href: 'https://approved.rs/sr/' },
      { hreflang: 'es', href: 'https://approved.rs/es/' },
      { hreflang: 'de', href: 'https://approved.rs/de/' },
      { hreflang: 'x-default', href: 'https://approved.rs/ru/' },
    ]);
  });

  it('keeps the path below the locale segment', () => {
    const links = set.getAlternateLinks(
      'https://approved.rs',
      '/en/vehicle-import/de/',
    );

    expect(links[0]).toEqual({
      hreflang: 'ru',
      href: 'https://approved.rs/ru/vehicle-import/de/',
    });
  });

  it('points x-default at the source language', () => {
    const links = set.getAlternateLinks('https://approved.rs', '/sr/services/');

    expect(links.at(-1)).toEqual({
      hreflang: 'x-default',
      href: 'https://approved.rs/ru/services/',
    });
  });
});
