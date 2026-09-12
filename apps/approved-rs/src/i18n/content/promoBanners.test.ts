import { describe, it, expect } from 'vitest';
import { getPromoBanners } from './promoBanners';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('getPromoBanners', () => {
  it('returns every sourcing banner, for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(getPromoBanners(locale).length).toBe(10);
    }
  });

  it('en, sr, es and de contain different text than ru (real translations, not copies)', () => {
    expect(getPromoBanners('en')[0]).not.toBe(getPromoBanners('ru')[0]);
    expect(getPromoBanners('sr')[0]).not.toBe(getPromoBanners('ru')[0]);
    expect(getPromoBanners('es')[0]).not.toBe(getPromoBanners('ru')[0]);
    expect(getPromoBanners('de')[0]).not.toBe(getPromoBanners('ru')[0]);
  });
});
