import { describe, it, expect } from 'vitest';
import { legacyIncomesSchema, legacyPayoutAmount } from './legacyIncomes.ts';

const WON = '2026-01-01T00:00:00.000Z';
const PAID = '2026-02-02T00:00:00.000Z';

function read(money: Record<string, unknown>) {
  return legacyIncomesSchema.parse({
    statusChangedAt: WON,
    commissionPercent: 10,
    ...money,
  });
}

describe('legacyPayoutAmount', () => {
  it('rounds each income to the cent', () => {
    expect(legacyPayoutAmount(10.05, 33)).toBe(3.32);
  });
});

describe('legacy money on a stored Lead', () => {
  it('has nothing to migrate on a Lead without money', () => {
    expect(legacyIncomesSchema.parse({ statusChangedAt: WON })).toEqual({
      percent: 0,
      incomes: [],
    });
  });

  it('keeps incomes already written as incomes, with their rate', () => {
    const incomes = [{ id: 3, amount: 200, at: WON, paidAt: null }];
    expect(read({ commissionPercent: 50, incomes })).toEqual({
      percent: 50,
      incomes,
    });
  });

  it('turns a paid-off deal into one settled income', () => {
    expect(
      read({
        dealAmount: 1000,
        paidAmount: 100,
        payments: [{ amount: 100, at: PAID }],
      }).incomes,
    ).toEqual([{ id: 1, amount: 1000, at: WON, paidAt: PAID }]);
  });

  it('settles a paid-off deal at the status change when no payment was logged', () => {
    expect(read({ dealAmount: 1000, paidAmount: 100 }).incomes).toEqual([
      { id: 1, amount: 1000, at: WON, paidAt: WON },
    ]);
  });

  it('keeps an unpaid deal owed, dated from the status change', () => {
    expect(read({ dealAmount: 1000 }).incomes).toEqual([
      { id: 1, amount: 1000, at: WON, paidAt: null },
    ]);
  });

  it('leaves a zero-euro deal without an income', () => {
    expect(read({ dealAmount: 0 }).incomes).toEqual([]);
  });

  it('splits a part-paid deal at what the payment covered', () => {
    expect(
      read({
        dealAmount: 100_000,
        paidAmount: 3000,
        payments: [{ amount: 3000, at: PAID }],
      }).incomes,
    ).toEqual([
      { id: 1, amount: 30_000, at: WON, paidAt: PAID },
      { id: 2, amount: 70_000, at: WON, paidAt: null },
    ]);
  });

  it('keeps a deal on a zero rate whole and unsettled', () => {
    expect(read({ commissionPercent: 0, dealAmount: 1000 }).incomes).toEqual([
      { id: 1, amount: 1000, at: WON, paidAt: null },
    ]);
  });

  it('keeps a deal whole when the payment covers less than a cent', () => {
    expect(read({ dealAmount: 1000, paidAmount: 0.001 }).incomes).toEqual([
      { id: 1, amount: 1000, at: WON, paidAt: null },
    ]);
  });

  it('refuses money it has no rate to price', () => {
    expect(
      legacyIncomesSchema.safeParse({ statusChangedAt: WON, dealAmount: 300 })
        .success,
    ).toBe(false);
  });
});
