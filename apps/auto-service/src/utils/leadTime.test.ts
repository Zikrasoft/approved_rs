import { describe, expect, it } from 'vitest';
import {
  formatLeadTime,
  offerAvailability,
  plural,
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

describe('plural', () => {
  const forms = { one: '{n} деталь', few: '{n} детали', other: '{n} деталей' };

  it.each([
    [1, '{n} деталь'],
    [3, '{n} детали'],
    [5, '{n} деталей'],
  ])('picks the Russian form for %i', (count, form) => {
    expect(plural(count, forms, 'ru-RU')).toBe(form);
  });

  it('falls back to the other form when the copy lacks the one asked for', () => {
    expect(plural(3, { one: 'one', other: 'other' }, 'ru-RU')).toBe('other');
  });
});

describe('offerAvailability', () => {
  const copy = {
    columns: {
      stock: 'В наличии',
      leadTime: 'Забрать',
      inStockPickup: 'В наличии, забрать {days}',
    },
    leadTime: {
      inStock: 'В наличии',
      tomorrow: 'завтра',
      days: {
        one: 'через {days} день',
        few: 'через {days} дня',
        other: 'через {days} дней',
      },
    },
  };

  it.each([
    [3, 0, { stock: 'В наличии', lead: null, buyable: true }],
    [
      3,
      2,
      { stock: 'В наличии, забрать через 2 дня', lead: null, buyable: true },
    ],
    [0, 1, { stock: null, lead: 'Забрать завтра', buyable: true }],
    [0, 5, { stock: null, lead: 'Забрать через 5 дней', buyable: true }],
    [0, 0, { stock: null, lead: null, buyable: false }],
  ])(
    'words stock %i with lead time %i',
    (stock_quantity, lead_time_days, said) => {
      expect(
        offerAvailability({ stock_quantity, lead_time_days }, copy, 'ru-RU'),
      ).toEqual(said);
    },
  );
});
