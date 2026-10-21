import { describe, expect, it } from 'vitest';
import { formatLeadTime } from './leadTime';

describe('formatLeadTime', () => {
  const copy = { inStock: 'В наличии', daysTemplate: '{days} дн.' };

  it('says in stock for an offer ready today', () => {
    expect(formatLeadTime(0, copy)).toBe('В наличии');
  });

  it('counts the days to delivery', () => {
    expect(formatLeadTime(3, copy)).toBe('3 дн.');
  });
});
