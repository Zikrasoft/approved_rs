import { describe, it, expect } from 'vitest';
import { createLeadSchema, LEGACY_BRAND } from './schema.ts';

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
  it('rejects a negative commission rate', () => {
    expect(() => createLeadSchema({ defaultCommissionPercent: -1 })).toThrow(
      'defaultCommissionPercent must not be negative',
    );
  });
});

describe('brand on a store shared by several businesses', () => {
  it('reads a record written before the brand field existed as the original business', () => {
    const schema = createLeadSchema({ defaultCommissionPercent: 50 });

    expect(schema.parse(base).brand).toBe(LEGACY_BRAND);
  });

  it('keeps the brand already stored on the lead, so one store can hold several businesses', () => {
    const schema = createLeadSchema({ defaultCommissionPercent: 10 });

    expect(schema.parse({ ...base, brand: 'PRIZMA' }).brand).toBe('PRIZMA');
  });

  it('does not restamp another brand lead with the reading business own brand', () => {
    const prizma = createLeadSchema({ defaultCommissionPercent: 20 });
    const autohub = createLeadSchema({ defaultCommissionPercent: 15 });

    const stored = prizma.parse({ ...base, brand: 'PRIZMA' });
    expect(autohub.parse(stored).brand).toBe('PRIZMA');
  });
});

describe('per-business commission default', () => {
  it('applies the business default to a lead that carries no rate of its own', () => {
    const schema = createLeadSchema({ defaultCommissionPercent: 50 });

    expect(schema.parse(base).commissionPercent).toBe(50);
  });

  it('keeps a rate already stored on the lead, so a default change cannot rewrite history', () => {
    const schema = createLeadSchema({ defaultCommissionPercent: 50 });

    expect(
      schema.parse({ ...base, commissionPercent: 10 }).commissionPercent,
    ).toBe(10);
  });

  it('accepts a zero rate as a real value rather than falling back to the default', () => {
    const schema = createLeadSchema({ defaultCommissionPercent: 50 });

    expect(
      schema.parse({ ...base, commissionPercent: 0 }).commissionPercent,
    ).toBe(0);
  });
});

describe('records other businesses wrote', () => {
  it('keeps a locale this business does not serve, so a shared store is not truncated', () => {
    const schema = createLeadSchema({ defaultCommissionPercent: 10 });

    expect(schema.parse({ ...base, locale: 'de' }).locale).toBe('de');
  });

  it('keeps a comment longer than any form would accept, so old records survive a read', () => {
    const schema = createLeadSchema({ defaultCommissionPercent: 10 });
    const comment = 'x'.repeat(9000);

    expect(schema.parse({ ...base, comment }).comment).toBe(comment);
  });
});
