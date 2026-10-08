import { describe, it, expect } from 'vitest';
import { content } from '@/i18n/content';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('content().promoBanners', () => {
  it('returns every sourcing banner, for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(content(locale).promoBanners.sourcing.length).toBe(10);
    }
  });

  it('en, sr, es and de contain different text than ru (real translations, not copies)', () => {
    expect(content('en').promoBanners.sourcing[0]).not.toBe(
      content('ru').promoBanners.sourcing[0],
    );
    expect(content('sr').promoBanners.sourcing[0]).not.toBe(
      content('ru').promoBanners.sourcing[0],
    );
    expect(content('es').promoBanners.sourcing[0]).not.toBe(
      content('ru').promoBanners.sourcing[0],
    );
    expect(content('de').promoBanners.sourcing[0]).not.toBe(
      content('ru').promoBanners.sourcing[0],
    );
  });
});
