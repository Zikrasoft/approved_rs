import { describe, expect, it } from 'vitest';
import {
  leadTimeCopyFrom,
  offerAvailability,
  pickupTime,
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
  const ru = {
    inStock: 'В наличии',
    inStockTomorrow: 'В наличии, забрать завтра',
    inStockDays: {
      one: 'В наличии, забрать через {days} день',
      few: 'В наличии, забрать через {days} дня',
      other: 'В наличии, забрать через {days} дней',
    },
    tomorrow: 'Забрать завтра',
    days: {
      one: 'Забрать через {days} день',
      few: 'Забрать через {days} дня',
      other: 'Забрать через {days} дней',
    },
  };

  it.each([
    [3, 0, { stock: 'В наличии', lead: null, buyable: true }],
    [3, 1, { stock: 'В наличии, забрать завтра', lead: null, buyable: true }],
    [
      3,
      2,
      { stock: 'В наличии, забрать через 2 дня', lead: null, buyable: true },
    ],
    [0, 1, { stock: null, lead: 'Забрать завтра', buyable: true }],
    [0, 5, { stock: null, lead: 'Забрать через 5 дней', buyable: true }],
    [0, 21, { stock: null, lead: 'Забрать через 21 день', buyable: true }],
    [0, 0, { stock: null, lead: null, buyable: false }],
  ])(
    'words stock %i with lead time %i',
    (stock_quantity, lead_time_days, said) => {
      expect(
        offerAvailability({ stock_quantity, lead_time_days }, ru, 'ru-RU'),
      ).toEqual(said);
    },
  );

  it('takes every phrase whole from the copy, so no language gets a stitched preposition', () => {
    const en = {
      inStock: 'In stock',
      inStockTomorrow: 'In stock, ready tomorrow',
      inStockDays: {
        one: 'In stock, ready in {days} day',
        other: 'In stock, ready in {days} days',
      },
      tomorrow: 'Ready tomorrow',
      days: { one: 'Ready in {days} day', other: 'Ready in {days} days' },
    };
    const said = [
      [3, 1],
      [3, 2],
      [0, 1],
      [0, 2],
    ].map(([stock_quantity, lead_time_days]) =>
      offerAvailability({ stock_quantity, lead_time_days }, en, 'en-GB'),
    );
    expect(said.map(({ stock, lead }) => stock ?? lead)).toEqual([
      'In stock, ready tomorrow',
      'In stock, ready in 2 days',
      'Ready tomorrow',
      'Ready in 2 days',
    ]);
  });

  it('words a cart line, which knows only whether it is in stock, the same way', () => {
    expect(
      offerAvailability({ in_stock: true, lead_time_days: 2 }, ru, 'ru-RU'),
    ).toEqual(
      offerAvailability({ stock_quantity: 3, lead_time_days: 2 }, ru, 'ru-RU'),
    );
    expect(
      offerAvailability({ in_stock: false, lead_time_days: 0 }, ru, 'ru-RU')
        .buyable,
    ).toBe(false);
  });

  it('drops the pickup tail from a stock line when asked to be short', () => {
    expect(
      offerAvailability({ stock_quantity: 3, lead_time_days: 2 }, ru, 'ru-RU', {
        short: true,
      }).stock,
    ).toBe('В наличии');
  });

  it('reads the copy a page hands its element, and nothing else', () => {
    expect(leadTimeCopyFrom(JSON.stringify(ru))).toEqual(ru);
    expect(leadTimeCopyFrom('{"inStock":1}')).toBeNull();
    expect(leadTimeCopyFrom('not json')).toBeNull();
    expect(leadTimeCopyFrom(undefined)).toBeNull();
  });
});

describe('pickupTime', () => {
  it('says tomorrow for one day and counts the days otherwise', () => {
    const copy = {
      inStock: '',
      inStockTomorrow: '',
      inStockDays: { other: '' },
      tomorrow: 'Забрать завтра',
      days: {
        one: 'Забрать через {days} день',
        other: 'Забрать через {days} дня',
      },
    };
    expect(pickupTime(1, copy, 'ru-RU')).toBe('Забрать завтра');
    expect(pickupTime(3, copy, 'ru-RU')).toBe('Забрать через 3 дня');
  });
});
