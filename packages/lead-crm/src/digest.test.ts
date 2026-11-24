import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmDatabase } from './database.ts';
import type { LeadInput, StoredLead } from './schema.ts';
import { createLeadStore, type LeadStore } from './store.ts';
import { seedLead } from './testing/seed.ts';

let store: LeadStore;
let seeded: StoredLead[];

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

async function seed(specs: Partial<StoredLead>[]): Promise<StoredLead[]> {
  seeded = [];
  for (const [i, extra] of specs.entries()) {
    seeded.push(
      await seedLead({
        ...baseData,
        statusChangedAt: at(1),
        createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, 0, i)).toISOString(),
        ...extra,
      }),
    );
  }
  return seeded;
}

const nth = (id: string) => seeded.findIndex((l) => l.id === id) + 1;
const ids = (leads: { id: string }[]) => leads.map((l) => nth(l.id));
const digestMarks = async () =>
  (await crmDatabase().digest.findMany()).map((m) => ({
    ...m,
    day: m.day.toISOString().slice(0, 10),
  }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  onDay(1);
  store = createLeadStore();
});

afterEach(() => vi.useRealTimers());

describe('claimDigest', () => {
  it('lists open Leads idle for 7 days, measured from their last action', async () => {
    await seed([
      {},
      { lastActivityAt: at(5) },
      { statusChangedAt: at(5) },
      { lastActivityAt: at(3) },
      { status: 'lost' },
      { status: 'won' },
      { status: 'negotiations' },
      { status: 'negotiations', lastActivityAt: at(5) },
    ]);

    const digest = (await store.claimDigest(new Date(at(11))))!;

    expect(ids(digest.stale)).toEqual([1, 4, 7]);
    expect(Object.keys(digest)).toEqual(['stale', 'due']);
  });

  it('lists postponed Leads only once their day has come', async () => {
    await seed([
      { status: 'postponed', remindAt: '2026-10-05' },
      { status: 'postponed', remindAt: '2026-10-06' },
      { status: 'postponed', remindAt: null },
    ]);

    expect(ids((await store.claimDigest(new Date(at(5))))!.due)).toEqual([1]);
    expect(ids((await store.claimDigest(new Date(at(6))))!.due)).toEqual([
      1, 2,
    ]);
  });

  it('turns the day at midnight in Belgrade, not UTC', async () => {
    await seed([{ status: 'postponed', remindAt: '2026-10-06' }]);

    const beforeMidnight = new Date('2026-10-05T21:59:00.000Z');
    const afterMidnight = new Date('2026-10-05T22:01:00.000Z');
    expect(await store.claimDigest(beforeMidnight)).toEqual({
      stale: [],
      due: [],
    });
    expect(ids((await store.claimDigest(afterMidnight))!.due)).toEqual([1]);
    expect(await digestMarks()).toEqual([
      expect.objectContaining({ day: '2026-10-06' }),
    ]);
  });

  it('claims a day once, however often the cron runs that day', async () => {
    await seed([{}]);

    expect(await store.claimDigest(new Date(at(9)))).toBeDefined();
    expect(
      await store.claimDigest(new Date(at(9).replace('T00', 'T12'))),
    ).toBeUndefined();
    expect(await store.claimDigest(new Date(at(10)))).toBeDefined();
    expect((await digestMarks()).map((m) => m.day)).toEqual(['2026-10-10']);
  });

  it('fails loudly when the database refuses the claim for another reason', async () => {
    await seed([{}]);
    const refusing = createLeadStore({
      database: () =>
        new Proxy(crmDatabase(), {
          get: (client, key) =>
            key === '$transaction'
              ? () => Promise.reject(new Error('connection lost'))
              : Reflect.get(client, key),
        }),
    });

    await expect(refusing.claimDigest(new Date(at(9)))).rejects.toThrow(
      'connection lost',
    );
  });

  it('claims no day when there is nothing to list', async () => {
    await seed([{ status: 'won' }]);

    expect(await store.claimDigest(new Date(at(2)))).toEqual({
      stale: [],
      due: [],
    });
    expect(await digestMarks()).toEqual([]);
  });

  it('gives the day back once released, so a failed post is retried', async () => {
    await seed([{}]);
    await store.claimDigest(new Date(at(9)));
    await store.releaseDigest(new Date(at(9)));

    expect(await digestMarks()).toEqual([]);
    expect(await store.claimDigest(new Date(at(9)))).toBeDefined();
  });
});

describe('the posted digest', () => {
  let posted: Parameters<LeadStore['recordDigestMessage']>[1];
  const left = (open: Awaited<ReturnType<LeadStore['takeFromDigest']>>) =>
    open && {
      messageId: open.messageId,
      due: ids(open.digest.due),
      stale: ids(open.digest.stale),
      hidden: open.hidden,
    };
  const stored = async () => {
    const entries = await crmDatabase().digestLead.findMany({
      orderBy: { position: 'asc' },
    });
    const listed = (list: 'due' | 'stale') =>
      entries.filter((e) => e.list === list).map((e) => nth(e.leadId));
    return { dueIds: listed('due'), staleIds: listed('stale') };
  };

  beforeEach(async () => {
    const [one, two, three] = await seed([{}, {}, {}, {}]);
    posted = {
      messageId: 77,
      dueIds: [one!.id],
      staleIds: [two!.id, three!.id],
      hidden: 4,
    };
    await store.claimDigest(new Date(at(9)));
    await store.recordDigestMessage(new Date(at(9)), posted);
  });

  it('takes a Lead out of the last posted digest and hands back the open Leads left', async () => {
    expect(left(await store.takeFromDigest(seeded[1]!.id))).toEqual({
      messageId: 77,
      due: [1],
      stale: [3],
      hidden: 4,
    });
    expect(left(await store.takeFromDigest(seeded[0]!.id))).toEqual({
      messageId: 77,
      due: [],
      stale: [3],
      hidden: 4,
    });
    expect(await stored()).toEqual({ dueIds: [], staleIds: [3] });
  });

  it('forgets Leads closed or deleted since the digest went out', async () => {
    await store.setStatus(seeded[0]!.id, 'won');
    await store.deleteLead(seeded[2]!.id);

    expect(left(await store.takeFromDigest(seeded[1]!.id))).toEqual({
      messageId: 77,
      due: [],
      stale: [],
      hidden: 4,
    });
    expect(await stored()).toEqual({ dueIds: [], staleIds: [] });
  });

  it('leaves the digest alone for a Lead it does not show', async () => {
    expect(await store.takeFromDigest(seeded[3]!.id)).toBeUndefined();
    expect(left(await store.takeFromDigest(seeded[1]!.id))).toMatchObject({
      stale: [3],
    });
  });

  it('only ever edits the latest digest', async () => {
    await store.claimDigest(new Date(at(17)));
    await store.recordDigestMessage(new Date(at(17)), {
      messageId: 88,
      dueIds: [],
      staleIds: [seeded[0]!.id],
      hidden: 0,
    });

    expect(await store.takeFromDigest(seeded[1]!.id)).toBeUndefined();
    expect(left(await store.takeFromDigest(seeded[0]!.id))).toMatchObject({
      messageId: 88,
    });
  });

  it('records nothing when the day was never claimed', async () => {
    await store.recordDigestMessage(new Date(at(20)), {
      ...posted,
      messageId: 99,
    });

    expect(left(await store.takeFromDigest(seeded[1]!.id))).toMatchObject({
      messageId: 77,
    });
  });
});

describe('every action on a Lead resets its clock', () => {
  let lead: StoredLead;

  beforeEach(async () => {
    [lead] = await seed([{ status: 'lost' }]);
    onDay(9);
  });

  it('an answered prompt', async () => {
    await store.setPendingPrompt(lead.id, {
      chatId: 5,
      messageId: 6,
      kind: 'postpone',
    });
    await store.resolvePendingPrompt({ chatId: 5, messageId: 6 }, () => ({}));
    expect((await store.getLead(lead.id))?.lastActivityAt).toBe(at(9));
  });
});
