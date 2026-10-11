import { describe, it, expect, vi } from 'vitest';
import { legacyIncomesSchema, legacyOwed } from './legacyIncomes.ts';

const WON = '2026-01-01T00:00:00.000Z';
const PAID = '2026-02-02T00:00:00.000Z';

function read(money: Record<string, unknown>) {
  return legacyIncomesSchema.parse({
    statusChangedAt: WON,
    commissionPercent: 10,
    ...money,
  });
}

describe('legacy money on a stored Lead', () => {
  it('has nothing to migrate on a Lead without money', () => {
    expect(legacyIncomesSchema.parse({ statusChangedAt: WON })).toEqual({
      percent: 10,
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

  it('prices money stored without a rate at the former 10% default', () => {
    expect(
      legacyIncomesSchema.parse({ statusChangedAt: WON, dealAmount: 300 }),
    ).toEqual({
      percent: 10,
      incomes: [{ id: 1, amount: 300, at: WON, paidAt: null }],
    });
  });
});

describe('legacyOwed', () => {
  const lead = (money: Record<string, unknown>) => ({
    statusChangedAt: WON,
    ...money,
  });

  it('is every unpaid income times its rate, each rounded to the cent', () => {
    const entries = [
      lead({
        commissionPercent: 33,
        incomes: [
          { id: 1, amount: 10.05, at: WON, paidAt: null },
          { id: 2, amount: 10.05, at: WON, paidAt: null },
          { id: 3, amount: 100, at: WON, paidAt: PAID },
        ],
      }),
      lead({ dealAmount: 300 }),
      lead({ dealAmount: 300, commissionPercent: 150 }),
    ];

    expect(legacyOwed(entries)).toBe(486.64);
  });

  it('owes nothing when everything was paid', () => {
    expect(
      legacyOwed([lead({ dealAmount: 300, paidAmount: 30, payments: [] })]),
    ).toBe(0);
  });

  it('logs money it cannot read instead of dropping it quietly, and skips non-Leads', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = lead({ dealAmount: 'a lot' });

    expect(
      legacyOwed([broken, { type: 'digest', day: '2026-10-10' }, 'junk']),
    ).toBe(0);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      '[lead-crm] legacy money left out of the opening',
      expect.objectContaining({ entry: broken }),
    );
    error.mockRestore();
  });
});
