import { describe, it, expect } from 'vitest';
import { createLeadSchema } from './schema.ts';

const base = {
  id: 1,
  name: 'Иван',
  contact: '@ivan',
  service: 'detailing',
  locale: 'ru',
  statusChangedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('createLeadSchema options', () => {
  it('rejects an empty locale list rather than accepting any locale', () => {
    expect(() =>
      createLeadSchema({
        locales: [],
        defaultCommissionPercent: 10,
        defaultBrand: 'Test',
      }),
    ).toThrow('locales must not be empty');
  });

  it('rejects a negative commission rate', () => {
    expect(() =>
      createLeadSchema({
        locales: ['ru'],
        defaultCommissionPercent: -1,
        defaultBrand: 'Test',
      }),
    ).toThrow('defaultCommissionPercent must not be negative');
  });
});

describe('per-business brand', () => {
  it('rejects an empty brand', () => {
    expect(() =>
      createLeadSchema({
        locales: ['ru'],
        defaultCommissionPercent: 10,
        defaultBrand: '',
      }),
    ).toThrow('defaultBrand must not be empty');
  });

  it('stamps the business own brand on a lead that carries none', () => {
    const schema = createLeadSchema({
      locales: ['ru'],
      defaultCommissionPercent: 50,
      defaultBrand: 'PRIZMA',
    });

    expect(schema.parse(base).brand).toBe('PRIZMA');
  });

  it('keeps the brand already stored on the lead, so one store can hold several businesses', () => {
    const schema = createLeadSchema({
      locales: ['ru'],
      defaultCommissionPercent: 10,
      defaultBrand: 'Approved.rs',
    });

    expect(schema.parse({ ...base, brand: 'PRIZMA' }).brand).toBe('PRIZMA');
  });
});

describe('per-business commission default', () => {
  it('applies the business default to a lead that carries no rate of its own', () => {
    // Detailing keeps a much larger share than sourcing — the rate is a
    // property of the business, not of the codebase.
    const schema = createLeadSchema({
      locales: ['ru'],
      defaultCommissionPercent: 50,
      defaultBrand: 'Test',
    });

    expect(schema.parse(base).commissionPercent).toBe(50);
  });

  it('keeps a rate already stored on the lead, so a default change cannot rewrite history', () => {
    const schema = createLeadSchema({
      locales: ['ru'],
      defaultCommissionPercent: 50,
      defaultBrand: 'Test',
    });

    expect(
      schema.parse({ ...base, commissionPercent: 10 }).commissionPercent,
    ).toBe(10);
  });

  it('accepts a zero rate as a real value rather than falling back to the default', () => {
    const schema = createLeadSchema({
      locales: ['ru'],
      defaultCommissionPercent: 50,
      defaultBrand: 'Test',
    });

    expect(
      schema.parse({ ...base, commissionPercent: 0 }).commissionPercent,
    ).toBe(0);
  });
});

describe('locale validation', () => {
  it('accepts a locale the business serves', () => {
    const schema = createLeadSchema({
      locales: ['ru', 'sr'],
      defaultCommissionPercent: 10,
      defaultBrand: 'Test',
    });

    expect(schema.parse({ ...base, locale: 'sr' }).locale).toBe('sr');
  });

  it('rejects a locale outside the configured set', () => {
    const schema = createLeadSchema({
      locales: ['ru', 'sr'],
      defaultCommissionPercent: 10,
      defaultBrand: 'Test',
    });

    expect(() => schema.parse({ ...base, locale: 'de' })).toThrow();
  });
});
