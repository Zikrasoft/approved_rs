import { describe, expect, it } from 'vitest';
import {
  availabilityText,
  formatLeadTime,
  schemaAvailability,
} from './leadTime';

describe('schemaAvailability', () => {
  it('says in stock while the supplier holds stock', () => {
    expect(schemaAvailability({ stock_quantity: 3, lead_time_days: 0 })).toBe(
      'InStock',
    );
  });

  it('says back order for an offer orderable on a lead time beyond stock', () => {
    expect(schemaAvailability({ stock_quantity: 0, lead_time_days: 4 })).toBe(
      'BackOrder',
    );
  });

  it('says out of stock for an offer nobody can order', () => {
    expect(schemaAvailability({ stock_quantity: 0, lead_time_days: 0 })).toBe(
      'OutOfStock',
    );
  });
});

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

  it('says tomorrow for a one-day lead time where the copy has the word', () => {
    expect(formatLeadTime(1, { ...copy, tomorrow: 'завтра' }, 'ru-RU')).toBe(
      'завтра',
    );
    expect(formatLeadTime(21, { ...copy, tomorrow: 'завтра' }, 'ru-RU')).toBe(
      '21 день',
    );
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

describe('availabilityText', () => {
  const copy = {
    stock: 'В наличии',
    leadTime: 'Забрать',
    inStockPickup: 'В наличии, забрать {days}',
    days: {
      inStock: 'В наличии',
      tomorrow: 'завтра',
      days: {
        one: 'через {days} день',
        few: 'через {days} дня',
        other: 'через {days} дней',
      },
    },
  };

  it('says in stock for stock ready today', () => {
    expect(
      availabilityText({ in_stock: true, lead_time_days: 0 }, copy, 'ru-RU'),
    ).toBe('В наличии');
  });

  it('says when stock held elsewhere can be picked up', () => {
    expect(
      availabilityText({ in_stock: true, lead_time_days: 2 }, copy, 'ru-RU'),
    ).toBe('В наличии, забрать через 2 дня');
    expect(
      availabilityText({ in_stock: true, lead_time_days: 1 }, copy, 'ru-RU'),
    ).toBe('В наличии, забрать завтра');
  });

  it('says when a part without stock can be picked up', () => {
    expect(
      availabilityText({ in_stock: false, lead_time_days: 4 }, copy, 'ru-RU'),
    ).toBe('Забрать через 4 дня');
  });

  it('says nothing for a part with neither stock nor a pickup time', () => {
    expect(
      availabilityText({ in_stock: false, lead_time_days: 0 }, copy, 'ru-RU'),
    ).toBeNull();
  });
});
