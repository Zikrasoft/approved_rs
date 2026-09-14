import { describe, it, expect } from 'vitest';
import { formatPrice } from './price';

describe('formatPrice', () => {
  it('groups thousands the way the locale does', () => {
    expect(formatPrice({ value: '25000', currency: '€' }, 'ru')).toBe(
      '25 000 €',
    );
    expect(formatPrice({ value: '25000', currency: '€' }, 'en')).toBe(
      '25,000 €',
    );
  });

  it('leaves the amount alone when it is not a number', () => {
    expect(formatPrice({ value: 'по запросу', currency: '€' }, 'ru')).toBe(
      'по запросу €',
    );
  });

  it('omits the currency when there is no amount', () => {
    expect(formatPrice({ value: '', currency: '€' }, 'ru')).toBe('');
  });

  it('omits the currency when the case has none', () => {
    expect(formatPrice({ value: '25000' }, 'ru')).toBe('25 000');
  });
});
