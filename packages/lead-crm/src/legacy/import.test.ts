import { describe, expect, it } from 'vitest';
import { crmDatabase } from '../database.ts';
import { importLegacy, readLegacy, type LegacyBlobs } from './import.ts';
import { createLeadStore } from '../store.ts';
import { createLedgerStore } from '../ledgerStore.ts';
import { leadComment } from '../telegram/cards.ts';

const store = createLeadStore();
const ledger = createLedgerStore();

const newLead = {
  brand: 'CarLab',
  name: 'Дарья',
  contact: '@darya',
  service: 'brakes',
  locale: 'sr',
};

const legacyLead = (id: number, fields: object = {}) => ({
  id,
  brand: 'CarLab',
  name: ['Анна', 'Борис', 'Вера', 'Глеб', 'Дина'][id - 1],
  contact: `@${['anna', 'boris', 'vera', 'gleb', 'dina'][id - 1]}`,
  service: 'brakes',
  locale: 'sr',
  status: 'negotiations',
  statusChangedAt: '2026-03-01T10:00:00.000Z',
  createdAt: '2026-03-01T09:00:00.000Z',
  ...fields,
});

const blobs: LegacyBlobs = {
  leads: [
    legacyLead(1, { orderId: 'order_1', archived: true, status: 'open' }),
    legacyLead(2, {
      pendingPrompt: { chatId: -1001, messageId: 5, kind: 'note' },
      remindAt: '2026-04-01',
      status: 'postponed',
      postponedFrom: 'in_progress',
    }),
    {
      type: 'digest',
      day: '2026-03-10',
      createdAt: '2026-03-10T07:00:00.000Z',
      posted: { messageId: 77, dueIds: [2, 99], staleIds: [1], hidden: 3 },
    },
    {
      type: 'digest',
      day: '2026-03-09',
      createdAt: '2026-03-09T07:00:00.000Z',
    },
    { id: 3 },
    legacyLead(4, { orderId: 'order_1' }),
    legacyLead(5, { createdAt: 'not a date' }),
  ],
  ledger: {
    operations: [
      {
        id: 1,
        type: 'payout',
        amount: 150.5,
        note: 'март',
        createdAt: '2026-03-02T10:00:00.000Z',
        createdBy: 'owner',
      },
      {
        id: 2,
        type: 'settlement',
        amount: 50,
        note: '',
        createdAt: '2026-03-03T10:00:00.000Z',
        createdBy: 'admin',
      },
    ],
    prompts: [
      {
        chatId: 42,
        messageId: 8,
        type: 'payout',
        createdAt: '2026-03-04T10:00:00.000Z',
      },
      {
        chatId: 42,
        messageId: 9,
        type: 'settlement',
        createdAt: '2026-03-04T10:00:00.000Z',
      },
    ],
  },
  quarantine: [{ id: 'broken' }, null],
};

const withLate = (lead: object): LegacyBlobs => ({
  ...blobs,
  leads: [...(blobs.leads as object[]), lead],
});

describe('readLegacy', () => {
  it('sorts the blobs into Leads, digests, the ledger and what it cannot read', () => {
    const records = readLegacy(blobs);

    expect(records.leads.map((l) => l.id)).toEqual([1, 2]);
    expect(records.leads[0]!.status).toBe('lost');
    expect(records.digests.map((d) => d.day)).toEqual([
      '2026-03-10',
      '2026-03-09',
    ]);
    expect(records.ledger.operations).toHaveLength(2);
    expect(records.unreadable).toEqual([
      { source: 'quarantine', payload: { id: 'broken' } },
      { source: 'quarantine', payload: null },
      { source: 'leads', payload: { id: 3 } },
      { source: 'leads', payload: legacyLead(4, { orderId: 'order_1' }) },
      { source: 'leads', payload: legacyLead(5, { createdAt: 'not a date' }) },
    ]);
  });

  it('keeps a whole blob it cannot read as one unreadable record', () => {
    const records = readLegacy({
      leads: { not: 'an array' },
      ledger: 'garbage',
      quarantine: undefined,
    });

    expect(records.leads).toEqual([]);
    expect(records.unreadable).toEqual([
      { source: 'leads', payload: { not: 'an array' } },
      { source: 'ledger', payload: 'garbage' },
    ]);
  });

  it('reads nothing from blobs that do not exist', () => {
    expect(
      readLegacy({
        leads: undefined,
        ledger: undefined,
        quarantine: undefined,
      }),
    ).toEqual({
      leads: [],
      digests: [],
      ledger: { operations: [], prompts: [] },
      unreadable: [],
      commentsKeptWhole: 0,
    });
  });
});

describe('readLegacy staff notes', () => {
  const noted = (comment: string) =>
    readLegacy({
      leads: [legacyLead(1, { comment })],
      ledger: undefined,
      quarantine: undefined,
    });

  it('splits the signed staff notes out of the visitor comment', () => {
    const records = noted(
      [
        'Ищу BMW X5 до 30 000 €',
        '14.10.2026 · Клиент (WhatsApp): Доп. контакт: +381641234567',
        '16.10.2026 · Админ: Звонил, не взял',
        'Отложено до 20.10.2026',
        '17.10.2026 · Владелец: Ждет цену до пятницы',
      ].join('\n'),
    );

    expect(records.leads[0]).toMatchObject({
      comment: [
        'Ищу BMW X5 до 30 000 €',
        '14.10.2026 · Клиент (WhatsApp): Доп. контакт: +381641234567',
        'Отложено до 20.10.2026',
      ].join('\n'),
      notes: [
        {
          author: 'admin',
          text: 'Звонил, не взял',
          createdAt: '2026-10-16T12:00:00.000Z',
        },
        {
          author: 'owner',
          text: 'Ждет цену до пятницы',
          createdAt: '2026-10-17T12:00:00.001Z',
        },
      ],
    });
    expect(records.commentsKeptWhole).toBe(0);
  });

  it('leaves a comment holding only notes empty', () => {
    expect(noted('16.10.2026 · Админ: Звонил').leads[0]!.comment).toBeNull();
  });

  it.each([
    [
      'a note that runs over several lines',
      '16.10.2026 · Админ: Звонил\nперезвонить вечером',
    ],
    [
      'a visitor answer written after a note',
      '16.10.2026 · Владелец: Ждет\nСообщение: а когда?',
    ],
  ])(
    'keeps a comment whole when it cannot tell where %s ends',
    (_, comment) => {
      const records = noted(comment);

      expect(records.leads[0]).toMatchObject({ comment, notes: [] });
      expect(records.commentsKeptWhole).toBe(1);
    },
  );
});

describe('importLegacy', () => {
  it('imports the staff notes it split out, signed as before', async () => {
    await importLegacy(
      crmDatabase,
      readLegacy({
        leads: [
          legacyLead(1, { comment: 'BMW X5\n16.10.2026 · Админ: Звонил' }),
        ],
        ledger: undefined,
        quarantine: undefined,
      }),
    );

    const [lead] = await store.readLeads();
    expect(lead).toMatchObject({
      comment: 'BMW X5',
      notes: [{ author: 'admin', text: 'Звонил' }],
    });
    expect(leadComment(lead!)).toBe('BMW X5\n16.10.2026 · Админ: Звонил');
  });

  it('imports every readable record and keeps the old number searchable', async () => {
    const counts = await importLegacy(crmDatabase, readLegacy(blobs));

    expect(counts).toEqual({
      leads: 2,
      digests: 2,
      operations: 2,
      prompts: 2,
      quarantined: 5,
      notes: 0,
      commentsKeptWhole: 0,
    });
    const [first] = await store.searchLeads('1');
    expect(first).toMatchObject({
      name: 'Анна',
      status: 'lost',
      orderId: 'order_1',
      createdAt: '2026-03-01T09:00:00.000Z',
    });
    const second = await store.findByPendingPrompt({
      chatId: -1001,
      messageId: 5,
    });
    expect(second).toMatchObject({
      name: 'Борис',
      remindAt: '2026-04-01',
      postponedFrom: 'in_progress',
    });
    expect(await ledger.readBalance()).toBe(100.5);
    expect(
      await ledger.findOperationPrompt({ chatId: 42, messageId: 9 }),
    ).toMatchObject({ type: 'settlement', expired: true });
  });

  it('keeps the old number and leaves a gap of 1000 for Leads that reach Blob late', async () => {
    await importLegacy(crmDatabase, readLegacy(blobs));

    expect((await store.searchLeads('#2'))[0]).toMatchObject({
      number: 2,
      name: 'Борис',
    });
    expect((await store.insertLead(newLead)).number).toBe(1002);
  });

  it('leaves the numbering alone when Blob held no Leads', async () => {
    await importLegacy(crmDatabase, readLegacy({ ...blobs, leads: [] }));

    expect((await store.insertLead(newLead)).number).toBe(1);
  });

  it('numbers new Leads after a rerun still after the gap', async () => {
    await importLegacy(crmDatabase, readLegacy(blobs));
    await importLegacy(crmDatabase, readLegacy(blobs));

    expect((await store.insertLead(newLead)).number).toBe(1002);
  });

  it('imports a Lead that reached Blob late with its own number inside the gap', async () => {
    await importLegacy(crmDatabase, readLegacy(blobs));
    const first = await store.insertLead(newLead);

    await importLegacy(crmDatabase, readLegacy(withLate(legacyLead(3))));

    expect((await store.searchLeads('#3'))[0]).toMatchObject({
      number: 3,
      name: 'Вера',
    });
    expect(first.number).toBe(1002);
    expect((await store.insertLead(newLead)).number).toBe(1003);
  });

  it('refuses to import over a new Lead that took an old number', async () => {
    const taken = await store.insertLead(newLead);

    await expect(
      importLegacy(crmDatabase, readLegacy(blobs)),
    ).rejects.toThrow();
    expect(await store.readLeads()).toEqual([taken]);
  });

  it('refuses a late Lead whose number a new Lead already took past the gap', async () => {
    await importLegacy(crmDatabase, readLegacy(blobs));
    const taken = await store.insertLead(newLead);

    await expect(
      importLegacy(
        crmDatabase,
        readLegacy(withLate(legacyLead(3, { id: 1002 }))),
      ),
    ).rejects.toThrow();
    expect(await store.getLead(taken.id)).toEqual(taken);
  });

  it('leaves the rows staff changed since the first run as they are', async () => {
    await importLegacy(crmDatabase, readLegacy(blobs));
    const [boris] = await store.searchLeads('#2');
    await store.setStatus(boris!.id, 'won');
    await store.takeFromDigest(boris!.id);
    await crmDatabase().ledgerOperation.updateMany({
      data: { note: 'исправлено' },
    });
    await crmDatabase().operationPrompt.updateMany({
      data: { type: 'payout' },
    });
    const before = await store.readLeads();

    await importLegacy(crmDatabase, readLegacy(blobs));

    expect(await store.readLeads()).toEqual(before);
    expect(await store.takeFromDigest(boris!.id)).toBeUndefined();
    expect((await ledger.readOperations()).map((op) => op.note)).toEqual([
      'исправлено',
      'исправлено',
    ]);
    expect(
      await ledger.findOperationPrompt({ chatId: 42, messageId: 9 }),
    ).toMatchObject({ type: 'payout' });
  });

  it('maps the digest rows onto the new ids', async () => {
    await importLegacy(crmDatabase, readLegacy(blobs));

    const left = await store.takeFromDigest(
      (await store.searchLeads('2'))[0]!.id,
    );

    expect(left).toEqual({
      messageId: 77,
      hidden: 3,
      digest: { due: [], stale: [] },
    });
  });

  it('changes nothing when it runs again', async () => {
    await importLegacy(crmDatabase, readLegacy(blobs));
    const leads = await store.readLeads();

    await importLegacy(crmDatabase, readLegacy(blobs));

    expect(await store.readLeads()).toEqual(leads);
    expect(await ledger.readOperations()).toHaveLength(2);
    expect(await crmDatabase().quarantinedRecord.count()).toBe(5);
    expect(await crmDatabase().digest.count()).toBe(2);
  });
});
