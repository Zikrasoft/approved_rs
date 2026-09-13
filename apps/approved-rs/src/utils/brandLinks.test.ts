import { describe, it, expect } from 'vitest';
import { brandHome } from './brandLinks';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('brandLinks', () => {
  it('keeps ru, sr and en, folds es and de to en', () => {
    expect(brandHome('carlab', 'ru')).toBe('https://carlab.rs/ru/');
    expect(brandHome('carlab', 'sr')).toBe('https://carlab.rs/sr/');
    expect(brandHome('carlab', 'en')).toBe('https://carlab.rs/en/');
    expect(brandHome('carlab', 'es')).toBe('https://carlab.rs/en/');
    expect(brandHome('carlab', 'de')).toBe('https://carlab.rs/en/');
  });

  it('returns absolute urls with a trailing slash for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const url of [
        brandHome('carlab', locale),
        brandHome('details', locale),
      ]) {
        expect(url).toMatch(/^https:\/\/(carlab|details)\.rs\//);
        expect(url.endsWith('/')).toBe(true);
      }
    }
  });
});
