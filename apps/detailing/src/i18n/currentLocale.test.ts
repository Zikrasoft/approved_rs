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

  it('falls back to the default locale at the site root', () => {
    expect(localeFrom('/')).toBe('ru');
  });

  it('falls back to the default locale outside the [locale] tree', () => {
    expect(localeFrom('/404')).toBe('ru');
  });

  it('falls back to the default locale for an unsupported language', () => {
    expect(localeFrom('/zh/services/')).toBe('ru');
  });

  it('falls back to the default locale for a prototype key', () => {
    expect(localeFrom('/constructor/')).toBe('ru');
  });
});
