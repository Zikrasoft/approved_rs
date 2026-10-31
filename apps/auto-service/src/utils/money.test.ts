import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('groups the amount the way the locale writes it and names the currency', () => {
    expect(formatMoney(12500, 'RSD', 'en-US')).toBe('12,500 RSD');
  });
});
