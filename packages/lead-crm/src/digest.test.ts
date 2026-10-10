import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMemoryStorage,
  type MemoryStorage,
} from './storage/memory.testing.ts';
import { storedLeadSchema, type LeadInput } from './schema.ts';
import { createLeadStore, type LeadStore } from './store.ts';

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

describe('money records left in the Lead file', () => {
  const retired = [
    { type: 'payout', id: 1, amount: 40, createdAt: at(1) },
    { type: 'settlement', id: 1, amount: 40, createdAt: at(1) },
    { type: 'summary', id: 1, month: '2026-10', createdAt: at(1) },
    { type: 'settle_prompt', chatId: 1, messageId: 2, createdAt: at(1) },
    { type: 'payout', id: 'broken' },
  ];

  it('are dropped on the next write without quarantine', async () => {
    storage.seed([storedLead(1), ...retired]);
    const quarantine = vi.fn().mockResolvedValue(undefined);
    store = createLeadStore({ storage, schema, quarantine });

    await store.addNote(1, 'Звонил');

    expect(quarantine).not.toHaveBeenCalled();
    expect(records()).toEqual([expect.objectContaining({ id: 1 })]);
    expect(await store.readLeads()).toHaveLength(1);
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
      storedLead(6, { status: 'won' }),
    ]);

    const digest = (await store.claimDigest(new Date(at(11))))!;

    expect(ids(digest.stale)).toEqual([1, 4]);
    expect(Object.keys(digest)).toEqual(['stale', 'due']);
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

  it('turns the day at midnight in Belgrade, not UTC', async () => {
    storage.seed([
      storedLead(1, { status: 'postponed', remindAt: '2026-10-06' }),
    ]);

    const beforeMidnight = new Date('2026-10-05T21:59:00.000Z');
    const afterMidnight = new Date('2026-10-05T22:01:00.000Z');
    expect(await store.claimDigest(beforeMidnight)).toEqual({
      stale: [],
      due: [],
    });
    expect(ids((await store.claimDigest(afterMidnight))!.due)).toEqual([1]);
    expect(records().filter((r) => r.type === 'digest')).toEqual([
      expect.objectContaining({ day: '2026-10-06' }),
    ]);
  });

  it('claims a day once, however often the cron runs that day', async () => {
    storage.seed([storedLead(1)]);

    expect(await store.claimDigest(new Date(at(9)))).toBeDefined();
    expect(
      await store.claimDigest(new Date(at(9).replace('T00', 'T12'))),
    ).toBeUndefined();
    expect(await store.claimDigest(new Date(at(10)))).toBeDefined();
    expect(records().filter((r) => r.type === 'digest')).toEqual([
      expect.objectContaining({ day: '2026-10-10' }),
    ]);
  });

  it('drops every earlier mark when it claims a new day', async () => {
    const mark = (day: string) => ({
      type: 'digest',
      day,
      createdAt: `${day}T06:00:00.000Z`,
    });
    storage.seed([storedLead(1), mark('2026-10-01'), mark('2026-10-08')]);

    await store.claimDigest(new Date(at(9)));

    expect(records().filter((r) => r.type === 'digest')).toEqual([
      expect.objectContaining({ day: '2026-10-09' }),
    ]);
  });

  it('claims no day when there is nothing to list', async () => {
    storage.seed([storedLead(1, { status: 'won' })]);

    expect(await store.claimDigest(new Date(at(2)))).toEqual({
      stale: [],
      due: [],
    });
    expect(records().filter((r) => r.type === 'digest')).toEqual([]);
  });

  it('gives the day back once released, so a failed post is retried', async () => {
    storage.seed([storedLead(1)]);
    await store.claimDigest(new Date(at(9)));
    await store.releaseDigest(new Date(at(9)));

    expect(records().filter((r) => r.type === 'digest')).toEqual([]);
    expect(await store.claimDigest(new Date(at(9)))).toBeDefined();
  });

  it('writes nothing when a claim or a release changes nothing', async () => {
    storage.seed([storedLead(1)]);
    await store.claimDigest(new Date(at(9)));
    const writes = storage.writeAttempts();

    await store.claimDigest(new Date(at(9)));
    await store.releaseDigest(new Date(at(10)));
    await store.updateLeads((leads) => leads.map((l) => ({ ...l })));

    expect(storage.writeAttempts()).toBe(writes);
  });
});

describe('every action on a Lead resets its clock', () => {
  beforeEach(() => {
    storage.seed([storedLead(1, { status: 'lost' })]);
    onDay(9);
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
    await store.resolvePendingPrompt({ chatId: 5, messageId: 6 }, () => ({}));
    expect((await store.getLead(1))?.lastActivityAt).toBe(at(9));
  });
});
