import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMemoryStorage,
  type MemoryStorage,
} from './storage/memory.testing.ts';
import { createLeadSchema, type LeadInput } from './schema.ts';
import { createLeadStore, type LeadStore } from './store.ts';
import { getCommission } from './money.ts';
import { isSettled } from './ledger.ts';

let storage: MemoryStorage;
let store: LeadStore;
const schema = createLeadSchema({ defaultCommissionPercent: 10 });

const baseData: LeadInput = {
  brand: 'CarLab',
  name: 'Иван',
  contact: '@ivan',
  service: 'brakes',
  locale: 'ru',
};

function at(day: number): string {
  return new Date(Date.UTC(2026, 9, day)).toISOString();
}

function onDay(day: number): void {
  vi.setSystemTime(new Date(at(day)));
}

function storedLead(id: number, extra: Record<string, unknown> = {}) {
  return {
    ...baseData,
    id,
    statusChangedAt: at(1),
    createdAt: at(1),
    ...extra,
  };
}

function records(): Record<string, unknown>[] {
  return storage.current() as Record<string, unknown>[];
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  onDay(1);
  storage = createMemoryStorage();
  store = createLeadStore({ storage, schema });
});

afterEach(() => vi.useRealTimers());

describe('addPayout', () => {
  it('stores a Lead-less Payout beside the Leads, Brand optional', async () => {
    await store.insertLead(baseData);
    const payout = await store.addPayout({
      amount: 30,
      by: 'owner',
      note: 'Иван, сервис повторно',
    });

    expect(payout).toEqual({
      type: 'payout',
      id: 1,
      amount: 30,
      note: 'Иван, сервис повторно',
      createdAt: at(1),
      createdBy: 'owner',
      leadId: null,
      brand: null,
      edits: [],
    });
    expect(records()).toEqual([
      expect.objectContaining({ id: 1, name: 'Иван' }),
      payout,
    ]);
    expect(await store.readLeads()).toHaveLength(1);
  });

  it('keeps a Brand named on a Lead-less Payout', async () => {
    const payout = await store.addPayout({
      amount: 30,
      by: 'owner',
      brand: 'Details',
    });
    expect(payout?.brand).toBe('Details');
  });

  it('ties a Payout to its Lead and takes the Lead brand', async () => {
    const lead = await store.insertLead(baseData);
    const payout = await store.addPayout({
      amount: 80,
      by: 'owner',
      leadId: lead.id,
    });
    expect(payout).toMatchObject({ id: 1, leadId: lead.id, brand: 'CarLab' });
    expect((await store.getLead(lead.id))?.status).toBe('new');
  });

  it('numbers Payouts one after another', async () => {
    await store.addPayout({ amount: 10, by: 'owner' });
    const second = await store.addPayout({ amount: 20, by: 'admin' });
    expect(second).toMatchObject({ id: 2, createdBy: 'admin' });
  });

  it('stores nothing for a Lead that does not exist', async () => {
    expect(
      await store.addPayout({ amount: 80, by: 'owner', leadId: 42 }),
    ).toBeUndefined();
    expect(await store.listPayouts()).toEqual([]);
  });

  it('turns a lost Lead won', async () => {
    const lead = await store.insertLead(baseData);
    await store.setStatus(lead.id, 'lost');
    onDay(2);
    await store.addPayout({ amount: 80, by: 'owner', leadId: lead.id });
    expect(await store.getLead(lead.id)).toMatchObject({
      status: 'won',
      statusChangedAt: at(2),
    });
  });

  it('accepts a zero Payout', async () => {
    expect(await store.addPayout({ amount: 0, by: 'owner' })).toMatchObject({
      amount: 0,
    });
  });

  it('refuses a negative amount', async () => {
    await expect(
      store.addPayout({ amount: -1, by: 'owner' }),
    ).rejects.toThrow();
  });
});

describe('addSettlement and the balance', () => {
  it('is all Payouts minus all Settlements, a partial Settlement included', async () => {
    const lead = await store.insertLead(baseData);
    await store.addPayout({ amount: 80, by: 'owner', leadId: lead.id });
    await store.addPayout({ amount: 30.1, by: 'owner' });
    const settlement = await store.addSettlement(50);

    expect(settlement).toEqual({
      type: 'settlement',
      id: 1,
      amount: 50,
      createdAt: at(1),
      createdBy: 'admin',
    });
    expect(await store.getBalance()).toBe(60.1);
    expect(records()).toContainEqual(settlement);
  });

  it('is zero on an empty store', async () => {
    expect(await store.getBalance()).toBe(0);
    expect(await store.readLedger()).toEqual({ payouts: [], settlements: [] });
  });

  it('refuses a zero Settlement', async () => {
    await expect(store.addSettlement(0)).rejects.toThrow();
  });
});

describe('listPayouts', () => {
  it('lists every Payout, or one Lead’s', async () => {
    const a = await store.insertLead(baseData);
    const b = await store.insertLead(baseData);
    await store.addPayout({ amount: 1, by: 'owner', leadId: a.id });
    await store.addPayout({ amount: 2, by: 'owner', leadId: b.id });
    await store.addPayout({ amount: 3, by: 'owner' });

    expect((await store.listPayouts()).map((p) => p.amount)).toEqual([1, 2, 3]);
    expect((await store.listPayouts(b.id)).map((p) => p.amount)).toEqual([2]);
  });

  it('keeps a deleted Lead’s Payouts', async () => {
    const lead = await store.insertLead(baseData);
    await store.addPayout({ amount: 80, by: 'owner', leadId: lead.id });
    await store.deleteLead(lead.id);
    expect(await store.listPayouts(lead.id)).toHaveLength(1);
  });
});

describe('correctPayout', () => {
  it('changes the amount and keeps before/after/at/by', async () => {
    const payout = await store.addPayout({ amount: 800, by: 'owner' });
    onDay(2);
    const result = await store.correctPayout(payout!.id, 80, 'owner');

    const corrected = {
      ...payout,
      amount: 80,
      edits: [{ before: 800, after: 80, at: at(2), by: 'owner' }],
    };
    expect(result).toEqual({ ok: true, payout: corrected });
    expect(await store.listPayouts()).toEqual([corrected]);
    expect(await store.getBalance()).toBe(80);
  });

  it('reports a Payout that does not exist', async () => {
    expect(await store.correctPayout(7, 80, 'admin')).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('locks a Payout for the owner once a Settlement is recorded after it', async () => {
    const payout = await store.addPayout({ amount: 800, by: 'owner' });
    onDay(2);
    await store.addSettlement(100);

    expect(await store.correctPayout(payout!.id, 80, 'owner')).toEqual({
      ok: false,
      reason: 'settled',
    });
    expect((await store.listPayouts())[0]?.amount).toBe(800);

    const byAdmin = await store.correctPayout(payout!.id, 80, 'admin');
    expect(byAdmin).toMatchObject({ ok: true, payout: { amount: 80 } });
  });

  it('leaves a Payout recorded after the last Settlement open to the owner', async () => {
    await store.addSettlement(100);
    onDay(2);
    const payout = await store.addPayout({ amount: 800, by: 'owner' });
    expect(await store.correctPayout(payout!.id, 80, 'owner')).toMatchObject({
      ok: true,
    });
  });
});

describe('isSettled', () => {
  it('needs a Settlement strictly after the Payout', async () => {
    const payout = (await store.addPayout({ amount: 10, by: 'owner' }))!;
    const same = await store.addSettlement(5);
    expect(isSettled(payout, [same])).toBe(false);
    onDay(2);
    const later = await store.addSettlement(5);
    expect(isSettled(payout, [same, later])).toBe(true);
  });
});

describe('migration from incomes', () => {
  const legacy = [
    storedLead(1, {
      status: 'won',
      commissionPercent: 10,
      incomes: [
        { id: 1, amount: 1000, at: at(1), paidAt: at(3) },
        { id: 2, amount: 333, at: at(2), paidAt: null },
      ],
    }),
    storedLead(2, {
      brand: 'Details',
      commissionPercent: 50,
      incomes: [{ id: 1, amount: 100, at: at(2), paidAt: null }],
    }),
    storedLead(3, {
      commissionPercent: 0,
      incomes: [{ id: 1, amount: 500, at: at(2), paidAt: at(4) }],
    }),
    storedLead(4, {
      status: 'won',
      dealAmount: 1000,
      paidAmount: 40,
      statusChangedAt: at(2),
      payments: [{ amount: 40, at: at(5) }],
    }),
  ];

  function owedBefore(): number {
    const leads = legacy.map((raw) => schema.parse(raw));
    return leads.reduce((sum, l) => sum + getCommission(l).remaining, 0);
  }

  beforeEach(() => storage.seed(legacy));

  it('keeps the balance owed', async () => {
    expect(await store.getBalance()).toBeCloseTo(owedBefore(), 2);
    expect(await store.getBalance()).toBe(143.3);
  });

  it('turns each income × rate into a Payout on its date, each paid income into a Settlement', async () => {
    const { payouts, settlements } = await store.readLedger();
    expect(payouts).toEqual([
      expect.objectContaining({
        amount: 100,
        createdAt: at(1),
        createdBy: 'owner',
        leadId: 1,
        brand: 'CarLab',
        migratedFrom: 'income:1:1',
      }),
      expect.objectContaining({ amount: 33.3, createdAt: at(2), leadId: 1 }),
      expect.objectContaining({ amount: 50, leadId: 2, brand: 'Details' }),
      expect.objectContaining({ amount: 40, leadId: 4, createdAt: at(2) }),
      expect.objectContaining({ amount: 60, leadId: 4, createdAt: at(2) }),
    ]);
    expect(payouts.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
    expect(settlements).toEqual([
      expect.objectContaining({
        id: 1,
        amount: 100,
        createdAt: at(3),
        createdBy: 'admin',
        migratedFrom: 'income:1:1',
      }),
      expect.objectContaining({ id: 2, amount: 40, createdAt: at(5) }),
    ]);
  });

  it('runs once: the next write persists it and later reads add nothing', async () => {
    const before = await store.readLedger();
    await store.addPayout({ amount: 10, by: 'owner' });
    const stored = records().filter((r) => r.type);
    expect(stored).toHaveLength(8);
    expect(await store.readLedger()).toEqual({
      payouts: [...before.payouts, expect.objectContaining({ id: 6 })],
      settlements: before.settlements,
    });
    expect(await store.getBalance()).toBeCloseTo(owedBefore() + 10, 2);
  });

  it('keeps a corrected migrated Payout corrected', async () => {
    await store.correctPayout(2, 30, 'admin');
    expect((await store.listPayouts(1)).map((p) => p.amount)).toEqual([
      100, 30,
    ]);
  });

  it('picks up an income or a confirmed payment the old flow adds later', async () => {
    await store.addPayout({ amount: 1, by: 'owner' });
    await store.updateLeads((leads) =>
      leads.map((l) =>
        l.id === 2
          ? {
              ...l,
              incomes: [
                { ...l.incomes[0]!, paidAt: at(6) },
                { id: 2, amount: 10, at: at(6), paidAt: null },
              ],
            }
          : l,
      ),
    );
    const { payouts, settlements } = await store.readLedger();
    expect(payouts.at(-1)).toMatchObject({
      amount: 5,
      migratedFrom: 'income:2:2',
    });
    expect(settlements.at(-1)).toMatchObject({
      amount: 50,
      migratedFrom: 'income:2:1',
    });
  });
});

describe('reading ledger records', () => {
  it('quarantines a broken ledger record instead of dropping it', async () => {
    const broken = { type: 'payout', id: 'x' };
    storage.seed([storedLead(1), broken]);
    const quarantine = vi.fn().mockResolvedValue(undefined);
    store = createLeadStore({ storage, schema, quarantine });

    await store.addPayout({ amount: 5, by: 'owner' });

    expect(quarantine).toHaveBeenCalledWith([broken]);
    expect(records()).toContainEqual(broken);
    expect(await store.listPayouts()).toHaveLength(1);
  });

  it('keeps ledger records through a Lead-only update', async () => {
    const lead = await store.insertLead(baseData);
    await store.addPayout({ amount: 5, by: 'owner' });
    await store.addSettlement(5);
    await store.setStatus(lead.id, 'won');
    expect(records().map((r) => r.type ?? 'lead')).toEqual([
      'lead',
      'payout',
      'settlement',
    ]);
  });
});
