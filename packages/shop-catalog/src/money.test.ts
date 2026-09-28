import { describe, it, expect } from 'vitest';
import { MEDUSA_LOCALE, formatPrice } from './money.ts';

const plain = (text: string) => text.replace(/\s/gu, ' ');

describe('formatPrice', () => {
  it.each([
    ['sr-Latn-RS', '11.190 RSD'],
    ['ru-RS', '11 190 RSD'],
    ['en-RS', 'RSD 11,190'],
  ])('formats dinars without decimals for %s', (locale, expected) => {
    expect(plain(formatPrice(11190, locale))).toBe(expected);
  });

  it('rounds to whole dinars', () => {
    expect(plain(formatPrice(11190.6, 'sr-Latn-RS'))).toBe('11.191 RSD');
  });

  it('formats zero, the price of pickup', () => {
    expect(plain(formatPrice(0, 'sr-Latn-RS'))).toBe('0 RSD');
  });
});

describe('MEDUSA_LOCALE', () => {
  it('maps every storefront locale to a Medusa locale code', () => {
    expect(MEDUSA_LOCALE).toEqual({ ru: 'ru-RU', sr: 'sr-RS', en: 'en-US' });
  });
});
