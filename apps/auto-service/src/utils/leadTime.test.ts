import { describe, expect, it } from 'vitest';
import { formatLeadTime } from './leadTime';

describe('formatLeadTime', () => {
  const copy = {
    inStock: 'В наличии',
    days: {
      one: '{days} день',
      few: '{days} дня',
      many: '{days} дней',
      other: '{days} дня',
    },
  };

  it('says in stock for an offer ready today', () => {
    expect(formatLeadTime(0, copy, 'ru-RU')).toBe('В наличии');
  });

  it('counts the days to delivery in the plural form the language needs', () => {
    expect(formatLeadTime(1, copy, 'ru-RU')).toBe('1 день');
    expect(formatLeadTime(3, copy, 'ru-RU')).toBe('3 дня');
    expect(formatLeadTime(5, copy, 'ru-RU')).toBe('5 дней');
    expect(formatLeadTime(21, copy, 'ru-RU')).toBe('21 день');
  });

  it('falls back to the other form when a language has no such form', () => {
    expect(
      formatLeadTime(
        2,
        { inStock: '', days: { one: '{days} day', other: '{days} days' } },
        'en-GB',
      ),
    ).toBe('2 days');
  });
});
