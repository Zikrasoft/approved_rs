import { describe, it, expect } from 'vitest';
import {
  BRAND_LOCALES,
  brandLocale,
  isBrandLocale,
  type BrandKey,
} from './brands.ts';
import { BRANDS, BRAND_SITES } from './registry.ts';

const KEYS = Object.keys(BRANDS) as BrandKey[];

describe('brand registry', () => {
  it.each(KEYS)('derives %s site url from its bare domain', (key) => {
    expect(BRAND_SITES[key]).toBe(`https://${BRANDS[key].domain}`);
  });

  it.each(KEYS)('keeps %s keyed by itself', (key) => {
    expect(BRANDS[key].url).toBe(BRAND_SITES[key]);
    expect(BRANDS[key].key).toBe(key);
  });

  it('stores bare domains without a scheme or trailing slash', () => {
    for (const key of KEYS) {
      expect(BRANDS[key].domain).not.toMatch(/^https?:|\/$/);
    }
  });

  it('gives every brand a distinct domain', () => {
    expect(new Set(KEYS.map((key) => BRANDS[key].domain)).size).toBe(
      KEYS.length,
    );
  });
});

describe('brandLocale', () => {
  it.each(BRAND_LOCALES)('passes %s through untouched', (locale) => {
    expect(brandLocale(locale)).toBe(locale);
  });

  it.each(['es', 'de'])('falls back to en for %s', (locale) => {
    expect(brandLocale(locale)).toBe('en');
  });

  it('falls back to en for an unknown value', () => {
    expect(brandLocale('zz')).toBe('en');
  });
});

describe('isBrandLocale', () => {
  it('accepts a brand locale', () => {
    expect(isBrandLocale('sr')).toBe(true);
  });

  it('rejects a locale the brand sites do not have', () => {
    expect(isBrandLocale('de')).toBe(false);
  });
});
