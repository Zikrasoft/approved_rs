import { describe, it, expect } from 'vitest';
import { localeFrom } from './currentLocale';
import { SUPPORTED_LOCALES } from './config';

describe('localeFrom', () => {
  it.each(SUPPORTED_LOCALES)(
    'reads %s off the first path segment',
    (locale) => {
      expect(localeFrom(`/${locale}/services/`)).toBe(locale);
    },
  );

  it('works for a bare locale root', () => {
    expect(localeFrom('/sr/')).toBe('sr');
  });

  it('falls back to the primary locale at the site root', () => {
    expect(localeFrom('/')).toBe('sr');
  });

  it('falls back to the primary locale outside the [locale] tree', () => {
    expect(localeFrom('/404')).toBe('sr');
  });

  it('falls back to the primary locale for an unsupported language', () => {
    expect(localeFrom('/zh/services/')).toBe('sr');
  });

  it('falls back to the primary locale for a prototype key', () => {
    expect(localeFrom('/constructor/')).toBe('sr');
  });
});
