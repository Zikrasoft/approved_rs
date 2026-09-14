import { describe, it, expect } from 'vitest';
import { pluralLabel } from './plural';
import { BCP47_BY_LOCALE, SUPPORTED_LOCALES } from '@/i18n/config';
import { getShopContent } from '@/i18n/content/shop';

describe('pluralLabel', () => {
  it.each(SUPPORTED_LOCALES)(
    'picks a form the %s reader would actually write',
    (locale) => {
      const forms = getShopContent(locale).matchCount;
      [0, 1, 2, 5, 21, 101].forEach((count) => {
        const label = pluralLabel(forms, BCP47_BY_LOCALE[locale], count);
        expect(label).toContain(String(count));
        expect(label).not.toContain('{count}');
      });
    },
  );

  it('declines the Russian noun by count, not by a single plural form', () => {
    const forms = getShopContent('ru').matchCount;
    const label = (n: number) => pluralLabel(forms, 'ru-RS', n);
    expect(label(1)).toBe('подходит 1 аккумулятор');
    expect(label(2)).toBe('подходит 2 аккумулятора');
    expect(label(5)).toBe('подходит 5 аккумуляторов');
    expect(label(21)).toBe('подходит 21 аккумулятор');
  });

  it('picks the Serbian few form for 2 and other for 5', () => {
    const forms = {
      one: 'one {count}',
      few: 'few {count}',
      many: 'many {count}',
      other: 'other {count}',
    };
    expect(pluralLabel(forms, 'sr-Latn-RS', 2)).toBe('few 2');
    expect(pluralLabel(forms, 'sr-Latn-RS', 5)).toBe('other 5');
  });

  it('keeps every plural category the Serbian shop copy needs', () => {
    const forms = getShopContent('sr').matchCount;
    for (const key of ['one', 'few', 'many', 'other'] as const) {
      expect(forms[key]).toContain('{count}');
    }
  });

  it('falls back to other for a category the locale does not define', () => {
    expect(pluralLabel({ other: '{count} batteries fit' }, 'en-RS', 1)).toBe(
      '1 batteries fit',
    );
  });
});
