import { describe, it, expect } from 'vitest';
import { getPromoBanners } from './promoBanners';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('getPromoBanners', () => {
  it('returns the right count for every kind, for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(getPromoBanners(locale, 'vehicle-sourcing').length).toBe(10);
      expect(getPromoBanners(locale, 'auto-service').length).toBe(6);
      expect(getPromoBanners(locale, 'detailing').length).toBe(2);
    }
  });

  it('defaults to the sourcing banners when kind is omitted', () => {
    expect(getPromoBanners('ru')).toEqual(
      getPromoBanners('ru', 'vehicle-sourcing'),
    );
  });

  it('en, sr, es and de contain different text than ru (real translations, not copies)', () => {
    expect(getPromoBanners('en', 'vehicle-sourcing')[0]).not.toBe(
      getPromoBanners('ru', 'vehicle-sourcing')[0],
    );
    expect(getPromoBanners('sr', 'vehicle-sourcing')[0]).not.toBe(
      getPromoBanners('ru', 'vehicle-sourcing')[0],
    );
    expect(getPromoBanners('es', 'vehicle-sourcing')[0]).not.toBe(
      getPromoBanners('ru', 'vehicle-sourcing')[0],
    );
    expect(getPromoBanners('de', 'vehicle-sourcing')[0]).not.toBe(
      getPromoBanners('ru', 'vehicle-sourcing')[0],
    );
  });
});
