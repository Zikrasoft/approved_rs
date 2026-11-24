import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLeadStore, type LeadStore } from './store.ts';
import { createLedgerStore, type LedgerStore } from './ledgerStore.ts';
import type { LeadId, LeadInput } from './schema.ts';

const TIMES = 8;

let store: LeadStore;
let ledger: LedgerStore;

beforeEach(() => {
  store = createLeadStore({
    standaloneServices: ['parts-order'],
  });
  ledger = createLedgerStore();
});

const click = (channel: LeadInput['contactChannel']): LeadInput => ({
  brand: 'Test',
  name: '',
  contact: '—',
  service: '',
  contactChannel: channel,
  visitorId: 'visitor-1',
  locale: 'ru',
  kind: 'call_click',
});

const together = <T>(times: number, run: (i: number) => Promise<T>) =>
  Promise.all(Array.from({ length: times }, (_, i) => run(i)));

describe('concurrent writers', () => {
  it('numbers Leads inserted at once without a repeat', async () => {
    const leads = await together(TIMES, (i) =>
      store.insertLead({ ...click('phone'), visitorId: `visitor-${i}` }),
    );

    expect(new Set(leads.map((l) => l.number)).size).toBe(TIMES);
  });

  it('merges simultaneous clicks of one visitor into a single Lead', async () => {
    const outcomes = await together(TIMES, (i) =>
      store.insertOrMergeLead(click(i % 2 ? 'whatsapp' : 'viber')),
    );

    expect(outcomes.filter((o) => !o.merged)).toHaveLength(1);
    expect(await store.readLeads()).toHaveLength(1);
  });

  it('stores one Lead for an order delivered several times at once', async () => {
    await together(TIMES, () =>
      store.insertOrMergeLead({
        brand: 'Test',
        name: 'Пётр',
        contact: '+381601234567',
        service: 'parts-order',
        locale: 'ru',
        orderId: 'order_1',
      }),
    );

    expect(await store.readLeads()).toHaveLength(1);
  });

  it('keeps every note appended to one Lead at once', async () => {
    const lead = await store.insertLead(click('telegram'));

    await together(TIMES, (i) =>
      store.updateCapture(lead.id, { note: `note ${i}`, capturePrompt: null }),
    );

    const notes = (await store.getLead(lead.id))!.comment!.split('\n');
    expect(notes.sort()).toEqual(
      Array.from({ length: TIMES }, (_, i) => `note ${i}`).sort(),
    );
  });

  it('lets one writer answer a pending prompt', async () => {
    const lead = await store.insertLead(click('telegram'));
    await store.setPendingPrompt(lead.id, {
      chatId: -100123456789,
      messageId: 5,
      kind: 'note',
    });

    const answers = await together(TIMES, (i) =>
      store.resolvePendingPrompt(
        { chatId: -100123456789, messageId: 5 },
        (l) => ({
          comment: `${l.comment ?? ''}answer ${i}`,
        }),
      ),
    );

    expect(answers.filter(Boolean)).toHaveLength(1);
  });

  it('adds one staff note when the same reply arrives several times at once', async () => {
    const lead = await store.insertLead(click('telegram'));
    await store.setPendingPrompt(lead.id, {
      chatId: -100123456789,
      messageId: 5,
      kind: 'note',
    });

    await together(TIMES, () =>
      store.resolvePendingPrompt(
        { chatId: -100123456789, messageId: 5 },
        () => ({ addNote: { author: 'admin', text: 'Звонил' } }),
      ),
    );

    expect((await store.getLead(lead.id))!.notes).toHaveLength(1);
  });

  it('keeps staff notes and visitor answers written to one Lead at once', async () => {
    const lead = await store.insertLead(click('telegram'));
    await store.setPendingPrompt(lead.id, {
      chatId: -100123456789,
      messageId: 5,
      kind: 'note',
    });

    await Promise.all([
      store.resolvePendingPrompt(
        { chatId: -100123456789, messageId: 5 },
        () => ({ addNote: { author: 'admin', text: 'Звонил' } }),
      ),
      store.postponeLead(lead.id, '2026-01-01', {
        author: 'owner',
        text: 'Отложено до 01.01.2026',
      }),
      ...Array.from({ length: TIMES }, (_, i) =>
        store.updateCapture(lead.id, {
          note: `answer ${i}`,
          capturePrompt: null,
        }),
      ),
    ]);

    const stored = (await store.getLead(lead.id))!;
    expect(stored.notes.map((note) => note.text).sort()).toEqual([
      'Звонил',
      'Отложено до 01.01.2026',
    ]);
    expect(stored.comment!.split('\n')).toHaveLength(TIMES);
  });

  it('hands a Lead to the manager and claims its Meta Lead once', async () => {
    const lead = await store.insertLead({
      ...click('telegram'),
      metaIds: { fbp: 'fb.1.1700000000000.123' },
    });

    const handoffs = await together(TIMES, () =>
      store.markManagerHandoff(lead.id, 'manager'),
    );
    const claims = await together(TIMES, () => store.claimMetaLead(lead.id));

    expect(handoffs.filter(Boolean)).toHaveLength(1);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it('claims a day of the digest once', async () => {
    const lead = await store.insertLead(click('telegram'));
    await store.postponeLead(lead.id, '2026-01-01', {
      author: 'owner',
      text: 'later',
    });

    const claims = await together(TIMES, () =>
      store.claimDigest(new Date('2026-06-01T08:00:00Z')),
    );

    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it('takes two Leads out of the posted digest at once', async () => {
    const now = new Date('2026-06-11T08:00:00Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-01T08:00:00Z'));
    const ids: LeadId[] = [];
    for (const channel of ['telegram', 'viber', 'whatsapp'] as const) {
      const lead = await store.insertLead({
        ...click(channel),
        visitorId: channel,
      });
      ids.push(lead.id);
    }
    vi.useRealTimers();
    await store.claimDigest(now);
    await store.recordDigestMessage(now, {
      messageId: 9,
      dueIds: [],
      staleIds: ids,
      hidden: 0,
    });

    await together(2, (i) => store.takeFromDigest(ids[i]!));

    expect(await store.takeFromDigest(ids[2]!)).toEqual({
      messageId: 9,
      hidden: 0,
      digest: { due: [], stale: [] },
    });
  });

  it('never debits more than the balance', async () => {
    await ledger.recordOperation({ type: 'payout', amount: 100, by: 'owner' });

    const debits = await together(TIMES, () =>
      ledger.recordOperation({ type: 'settlement', amount: 60, by: 'admin' }),
    );

    expect(debits.filter((d) => d.ok)).toHaveLength(1);
    expect(await ledger.readBalance()).toBe(40);
  });

  it('records one operation for a prompt answered at once', async () => {
    const key = { chatId: 42, messageId: 7 };
    await ledger.openOperationPrompt({ ...key, type: 'payout' });

    const answers = await together(TIMES, () =>
      ledger.answerOperationPrompt(key, { amount: 10, by: 'owner' }),
    );

    expect(answers.filter((a) => a.ok)).toHaveLength(1);
    expect(await ledger.readBalance()).toBe(10);
  });
});
