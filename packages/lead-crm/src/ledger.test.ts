import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMemoryStorage,
  type MemoryStorage,
} from './storage/memory.testing.ts';
import { storedLeadSchema, type LeadInput } from './schema.ts';
import { createLeadStore, type LeadStore } from './store.ts';
import { isSettled } from './ledger.ts';

let storage: MemoryStorage;
let store: LeadStore;
const schema = storedLeadSchema;

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
      pendingPrompt: null,
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
    expect((await store.getLead(lead.id))?.status).toBe('open');
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

describe('settlement prompts', () => {
  const prompt = { chatId: 222, messageId: 9 };

  it('answers only the prompt it stored, by chat and message', async () => {
    await store.addSettlePrompt(prompt);

    expect(await store.findSettlePrompt(222, 9)).toBe(true);
    expect(await store.findSettlePrompt(222, 10)).toBe(false);
    expect(await store.findSettlePrompt(111, 9)).toBe(false);
  });

  it('closes the prompt with the Settlement that answers it', async () => {
    await store.addSettlePrompt(prompt);
    await store.addSettlement(40);
    expect(await store.findSettlePrompt(222, 9)).toBe(true);

    await store.addSettlement(60, prompt);
    expect(await store.findSettlePrompt(222, 9)).toBe(false);
    expect(await store.getBalance()).toBe(-100);
  });

  it('forgets a prompt left unanswered for a week', async () => {
    onDay(1);
    await store.addSettlePrompt(prompt);
    onDay(8);
    await store.addSettlePrompt({ chatId: 222, messageId: 10 });

    expect(await store.findSettlePrompt(222, 9)).toBe(false);
    expect(await store.findSettlePrompt(222, 10)).toBe(true);
  });
});

describe('settleBalance', () => {
  it('records the whole balance the admin was shown', async () => {
    await store.addPayout({ amount: 80, by: 'owner' });
    await store.addSettlement(30);

    const settlement = await store.settleBalance(50);

    expect(settlement).toMatchObject({ type: 'settlement', amount: 50 });
    expect(await store.getBalance()).toBe(0);
  });

  it('compares the shown balance to the cent, not as a float', async () => {
    await store.addPayout({ amount: 0.1, by: 'owner' });
    await store.addPayout({ amount: 0.2, by: 'owner' });

    expect(await store.settleBalance(0.1 + 0.2)).toMatchObject({
      amount: 0.3,
    });
  });

  it('records nothing once the balance has moved, so a second tap is harmless', async () => {
    await store.addPayout({ amount: 80, by: 'owner' });
    await store.settleBalance(80);

    expect(await store.settleBalance(80)).toBeUndefined();
    expect((await store.readLedger()).settlements).toHaveLength(1);
  });

  it('records nothing when nothing is owed', async () => {
    expect(await store.settleBalance(0)).toBeUndefined();
    expect((await store.readLedger()).settlements).toEqual([]);
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

describe('payout prompts', () => {
  const prompt = { chatId: -100, messageId: 88 };

  it('holds a correction prompt on the Payout and clears it on correction', async () => {
    const payout = await store.addPayout({ amount: 80, by: 'owner' });
    expect(await store.setPayoutPrompt(payout!.id, prompt)).toMatchObject({
      pendingPrompt: prompt,
    });
    expect(await store.findPayoutByPrompt(-100, 88)).toMatchObject({
      id: payout!.id,
    });
    expect(await store.findPayoutByPrompt(-100, 89)).toBeUndefined();

    await store.correctPayout(payout!.id, 90, 'owner');
    expect(await store.findPayoutByPrompt(-100, 88)).toBeUndefined();
  });

  it('finds no Payout to hold a prompt for an unknown id', async () => {
    await store.addPayout({ amount: 80, by: 'owner' });
    expect(await store.setPayoutPrompt(9, prompt)).toBeUndefined();
  });
});

describe('claimMonthlySummary', () => {
  const NOV_1 = new Date('2026-11-01T08:00:00.000Z');

  it('claims nothing and writes nothing on any day but the 1st in Belgrade', async () => {
    const writes = storage.writeAttempts();
    expect(
      await store.claimMonthlySummary(new Date('2026-11-02T08:00:00.000Z')),
    ).toBeUndefined();
    expect(
      await store.claimMonthlySummary(new Date('2026-10-01T22:30:00.000Z')),
    ).toBeUndefined();
    expect(storage.writeAttempts()).toBe(writes);
  });

  it('counts the 1st by the Belgrade calendar, not UTC', async () => {
    const summary = await store.claimMonthlySummary(
      new Date('2026-10-31T23:30:00.000Z'),
    );
    expect(summary?.month).toBe('2026-11');
  });

  it('collects the balance, every Payout and the Leads without an outcome the first time', async () => {
    const open = await store.insertLead(baseData);
    const postponed = await store.insertLead(baseData);
    const won = await store.insertLead(baseData);
    const lost = await store.insertLead(baseData);
    await store.setStatus(postponed.id, 'postponed');
    await store.setStatus(won.id, 'won');
    await store.setStatus(lost.id, 'lost');
    const payout = await store.addPayout({ amount: 80, by: 'owner' });
    await store.addSettlement(30);

    const summary = await store.claimMonthlySummary(NOV_1);

    expect(summary).toEqual({
      month: '2026-11',
      since: null,
      balance: 50,
      payouts: [payout],
      leads: [
        expect.objectContaining({ id: open.id }),
        expect.objectContaining({ id: postponed.id }),
      ],
    });
    expect(records()).toContainEqual({
      type: 'summary',
      id: 1,
      month: '2026-11',
      createdAt: NOV_1.toISOString(),
    });
    expect(await store.readLeads()).toHaveLength(4);
  });

  it('claims a month once, however often the cron runs that day', async () => {
    expect(await store.claimMonthlySummary(NOV_1)).toBeDefined();
    expect(
      await store.claimMonthlySummary(new Date('2026-11-01T20:00:00.000Z')),
    ).toBeUndefined();
    expect(records().filter((r) => r.type === 'summary')).toHaveLength(1);
  });

  it('lists only the Payouts recorded since the previous summary', async () => {
    await store.addPayout({ amount: 10, by: 'owner' });
    await store.claimMonthlySummary(NOV_1);
    vi.setSystemTime(new Date('2026-11-15T00:00:00.000Z'));
    const later = await store.addPayout({ amount: 20, by: 'owner' });

    const summary = await store.claimMonthlySummary(
      new Date('2026-12-01T08:00:00.000Z'),
    );

    expect(summary).toMatchObject({
      month: '2026-12',
      since: NOV_1.toISOString(),
      balance: 30,
      payouts: [later],
    });
  });

  it('gives the month back once released, so a failed post is retried', async () => {
    await store.claimMonthlySummary(NOV_1);
    await store.releaseMonthlySummary('2026-11');
    expect(records().filter((r) => r.type === 'summary')).toEqual([]);
    expect(await store.claimMonthlySummary(NOV_1)).toMatchObject({
      since: null,
    });
  });
});

describe('claimDigest', () => {
  const ids = (leads: { id: number }[]) => leads.map((l) => l.id);

  it('lists open Leads idle for 7 days, measured from their last action', async () => {
    storage.seed([
      storedLead(1),
      storedLead(2, { lastActivityAt: at(5) }),
      storedLead(3, { statusChangedAt: at(5) }),
      storedLead(4, { lastActivityAt: at(3) }),
      storedLead(5, { status: 'lost' }),
    ]);

    const digest = (await store.claimDigest(new Date(at(11))))!;

    expect(ids(digest.stale)).toEqual([1, 4]);
  });

  it('lists won Leads until a Payout, even 0, is recorded for them', async () => {
    storage.seed([
      storedLead(1, { status: 'won' }),
      storedLead(2, { status: 'won' }),
      storedLead(3, { status: 'won' }),
    ]);
    await store.addPayout({ amount: 0, by: 'owner', leadId: 2 });
    await store.addPayout({ amount: 50, by: 'owner', leadId: 3 });

    expect(ids((await store.claimDigest(new Date(at(2))))!.unpaid)).toEqual([
      1,
    ]);
  });

  it('lists postponed Leads only once their day has come', async () => {
    storage.seed([
      storedLead(1, { status: 'postponed', remindAt: '2026-10-05' }),
      storedLead(2, { status: 'postponed', remindAt: '2026-10-06' }),
      storedLead(3, { status: 'postponed', remindAt: null }),
    ]);

    expect(ids((await store.claimDigest(new Date(at(5))))!.due)).toEqual([1]);
    expect(ids((await store.claimDigest(new Date(at(6))))!.due)).toEqual([
      1, 2,
    ]);
  });

  it('claims a day once, however often the cron runs that day', async () => {
    storage.seed([storedLead(1, { status: 'won' })]);

    expect(await store.claimDigest(new Date(at(2)))).toBeDefined();
    expect(
      await store.claimDigest(new Date(at(2).replace('T00', 'T12'))),
    ).toBeUndefined();
    expect(await store.claimDigest(new Date(at(3)))).toBeDefined();
    expect(records().filter((r) => r.type === 'digest')).toEqual([
      expect.objectContaining({ day: '2026-10-03' }),
    ]);
  });

  it('claims no day when there is nothing to list', async () => {
    storage.seed([storedLead(1, { status: 'lost' })]);

    expect(await store.claimDigest(new Date(at(2)))).toEqual({
      stale: [],
      unpaid: [],
      due: [],
    });
    expect(records().filter((r) => r.type === 'digest')).toEqual([]);
  });

  it('gives the day back once released, so a failed post is retried', async () => {
    storage.seed([storedLead(1, { status: 'won' })]);
    await store.claimDigest(new Date(at(2)));
    await store.releaseDigest(new Date(at(2)));

    expect(records().filter((r) => r.type === 'digest')).toEqual([]);
    expect(await store.claimDigest(new Date(at(2)))).toBeDefined();
  });
});

describe('every action on a Lead resets its clock', () => {
  beforeEach(() => {
    storage.seed([storedLead(1, { status: 'lost' })]);
    onDay(9);
  });

  it('a Payout, and the lost Lead it reopens as won', async () => {
    await store.addPayout({ amount: 10, by: 'owner', leadId: 1 });
    expect(await store.getLead(1)).toMatchObject({
      status: 'won',
      statusChangedAt: at(9),
      lastActivityAt: at(9),
    });
  });

  it('a Payout correction', async () => {
    const payout = await store.addPayout({ amount: 10, by: 'owner' });
    const linked = await store.addPayout({ amount: 0, by: 'owner', leadId: 1 });
    onDay(12);
    await store.correctPayout(payout!.id, 20, 'owner');
    expect((await store.getLead(1))?.lastActivityAt).toBe(at(9));
    await store.correctPayout(linked!.id, 20, 'owner');
    expect((await store.getLead(1))?.lastActivityAt).toBe(at(12));
  });

  it('a note', async () => {
    await store.addNote(1, 'Звонил');
    expect((await store.getLead(1))?.lastActivityAt).toBe(at(9));
  });

  it('an answered prompt', async () => {
    await store.setPendingPrompt(1, {
      chatId: 5,
      messageId: 6,
      kind: 'reply_visitor',
    });
    await store.resolvePendingPrompt(5, 6, () => ({}));
    expect((await store.getLead(1))?.lastActivityAt).toBe(at(9));
  });
});
