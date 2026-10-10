import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBrandStore, OPENING_NOTE } from './brandStore.ts';
import { createBrandBot } from './brandBot.ts';
import { LEADS_PATH, QUARANTINE_PATH } from './quarantine.ts';
import { LEDGER_PATH } from './ledgerStore.ts';
import { recordBotApi } from './testing/botApi.ts';
import {
  createMemoryStorage,
  type MemoryStorage,
} from './storage/memory.testing.ts';

const ENV = {
  TELEGRAM_BOT_TOKEN: 'token',
  TELEGRAM_BOT_USERNAME: 'crm_bot',
  TELEGRAM_GROUP_ID: '-100',
  TELEGRAM_OWNER_ID: '1,2',
  TELEGRAM_ADMIN_ID: '3',
};

const submission = {
  name: 'Иван',
  contact: '@ivan',
  service: 'vehicle-sourcing',
  locale: 'ru' as const,
};

let storages: Record<string, MemoryStorage>;
const storageFor = (path: string) => (storages[path] ??= createMemoryStorage());

function brandStore(getNotifier = vi.fn()) {
  return createBrandStore({
    brand: 'CarLab',
    storageFor,
    getNotifier,
  });
}

beforeEach(() => {
  storages = {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  for (const name of Object.keys(ENV)) vi.stubEnv(name, '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('createBrandStore', () => {
  it('builds without any Telegram env', () => {
    expect(() => brandStore()).not.toThrow();
    expect(Object.keys(storages)).toEqual([
      LEADS_PATH,
      LEDGER_PATH,
      QUARANTINE_PATH,
    ]);
  });

  it('reaches the notifier only once a record is quarantined', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const getNotifier = vi
      .fn()
      .mockResolvedValue({ notifier: { sendQuarantinedLeadsToAdmin: send } });
    const { leadStore } = brandStore(getNotifier);
    expect(getNotifier).not.toHaveBeenCalled();

    storages[LEADS_PATH]!.seed([{ id: 7 }]);
    await leadStore.insertLead({ ...submission, brand: 'CarLab' });

    expect(storages[QUARANTINE_PATH]!.current()).toEqual([{ id: 7 }]);
    expect(send).toHaveBeenCalledWith(1, QUARANTINE_PATH, 'CarLab');
  });
});

describe('the opening carry-over', () => {
  const WON = '2026-01-01T00:00:00.000Z';
  const legacyLead = (id: number, money: Record<string, unknown>) => ({
    ...submission,
    id,
    status: 'won',
    statusChangedAt: WON,
    createdAt: WON,
    ...money,
  });
  const owing = [
    legacyLead(1, {
      commissionPercent: 10,
      incomes: [
        { id: 1, amount: 1000, at: WON, paidAt: WON },
        { id: 2, amount: 333, at: WON, paidAt: null },
      ],
    }),
    legacyLead(2, {
      commissionPercent: 50,
      incomes: [{ id: 1, amount: 100, at: WON, paidAt: null }],
    }),
    legacyLead(3, {
      dealAmount: 1000,
      paidAmount: 40,
      payments: [{ amount: 40, at: WON }],
    }),
    legacyLead(4, { dealAmount: 300 }),
  ];
  const OLD_FIELDS = [
    'incomes',
    'payments',
    'paidAmount',
    'dealAmount',
    'commissionPercent',
  ];

  function seeded(leads: unknown) {
    const store = brandStore();
    storages[LEADS_PATH]!.seed(leads);
    return store;
  }

  const ledgerFile = () =>
    storages[LEDGER_PATH]!.current() as { operations: unknown[] };

  it('opens the Balance with the old owed amount, a missing rate priced at 10%', async () => {
    const { ledgerStore } = seeded(owing);

    expect(await ledgerStore.readOperations()).toEqual([
      expect.objectContaining({
        id: 1,
        type: 'payout',
        amount: 173.3,
        note: OPENING_NOTE,
        createdBy: 'owner',
      }),
    ]);
    expect(storages[LEDGER_PATH]!.current()).toBeUndefined();
  });

  it('writes the opening before a Lead write drops the old fields, and never again', async () => {
    const { leadStore, ledgerStore } = seeded(owing);

    await leadStore.insertLead({ ...submission, brand: 'CarLab' });
    await leadStore.insertLead({ ...submission, brand: 'CarLab' });

    expect(ledgerFile().operations).toHaveLength(1);
    for (const lead of storages[LEADS_PATH]!.current() as object[])
      for (const field of OLD_FIELDS) expect(lead).not.toHaveProperty(field);
    await brandStore().leadStore.insertLead({ ...submission, brand: 'CarLab' });

    expect(storages[LEDGER_PATH]!.writeAttempts()).toBe(1);
    expect(await ledgerStore.readBalance()).toBe(173.3);
  });

  it('carries an owed amount above what a reply may type, and lets Lead writes through', async () => {
    const { leadStore, ledgerStore } = seeded([
      legacyLead(1, { dealAmount: 20_000_000 }),
    ]);

    await leadStore.insertLead({ ...submission, brand: 'CarLab' });

    expect(await ledgerStore.readBalance()).toBe(2_000_000);
  });

  it('opens with no Payout when nothing was owed', async () => {
    const { leadStore, ledgerStore } = seeded([
      legacyLead(1, {
        incomes: [{ id: 1, amount: 100, at: WON, paidAt: WON }],
      }),
      { broken: true },
    ]);

    await leadStore.insertLead({ ...submission, brand: 'CarLab' });

    expect(ledgerFile()).toEqual({ operations: [], prompts: [] });
    expect(await ledgerStore.readBalance()).toBe(0);
  });

  it('opens with no Payout on a fresh store', async () => {
    const { leadStore } = brandStore();

    await leadStore.insertLead({ ...submission, brand: 'CarLab' });

    expect(ledgerFile()).toEqual({ operations: [], prompts: [] });
  });

  it('carries the old amount over exactly once under concurrent first writes', async () => {
    const [a, b] = [seeded(owing), brandStore()];

    await Promise.all([
      a.ledgerStore.recordOperation({ type: 'payout', amount: 5, by: 'owner' }),
      b.ledgerStore.recordOperation({ type: 'payout', amount: 7, by: 'admin' }),
      a.leadStore.insertLead({ ...submission, brand: 'CarLab' }),
      b.leadStore.insertLead({ ...submission, brand: 'CarLab' }),
    ]);

    const notes = (await a.ledgerStore.readOperations()).map((op) => op.note);
    expect(notes.filter((note) => note === OPENING_NOTE)).toHaveLength(1);
    expect(await b.ledgerStore.readBalance()).toBe(185.3);
  });

  it('lets the losing opener go on once another one opened the Balance', async () => {
    const [a, b] = [seeded(owing), brandStore()];

    await Promise.all([
      a.ledgerStore.ensureOpened(),
      b.ledgerStore.ensureOpened(),
    ]);

    expect(ledgerFile().operations).toHaveLength(1);
    expect(storages[LEDGER_PATH]!.writeAttempts()).toBe(2);
  });

  it('refuses to open from a Lead file it cannot read', async () => {
    const { ledgerStore } = seeded({ not: 'an array' });

    await expect(ledgerStore.readBalance()).rejects.toThrow();
  });

  it('retries the opening on the next Lead write when it failed to land', async () => {
    const { leadStore } = seeded(owing);
    vi.spyOn(storages[LEDGER_PATH]!, 'write').mockRejectedValueOnce(
      new Error('blob down'),
    );

    await expect(
      leadStore.insertLead({ ...submission, brand: 'CarLab' }),
    ).rejects.toThrow('blob down');
    expect(storages[LEDGER_PATH]!.current()).toBeUndefined();

    await leadStore.insertLead({ ...submission, brand: 'CarLab' });
    expect(ledgerFile().operations).toHaveLength(1);
  });
});

describe('createBrandBot', () => {
  function bot() {
    const { leadStore } = brandStore();
    return {
      leadStore,
      bot: createBrandBot({
        store: leadStore,
        brand: 'CarLab',
        serviceLabel: (slug) => slug,
      }),
    };
  }

  it.each(['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'TELEGRAM_GROUP_ID'])(
    'names %s when it is missing',
    (missing) => {
      for (const [name, value] of Object.entries(ENV))
        if (name !== missing) vi.stubEnv(name, value);

      expect(bot).toThrow(`${missing} is not set`);
    },
  );

  it('reads the owner and admin ids', () => {
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);

    const { ownerIds, adminIds } = bot().bot;

    expect(ownerIds).toEqual([1, 2]);
    expect(adminIds).toEqual([3]);
  });

  it('stamps its own brand over whatever the submission carries', async () => {
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
    vi.stubGlobal('fetch', recordBotApi().fetch);
    const { leadStore, bot: crm } = bot();
    const forged = { ...submission, brand: 'Approved.rs' };

    const result = await crm.notifyLead(forged, '[test]');

    expect(result.stored).toBe(true);
    const [lead] = await leadStore.readLeads();
    expect(lead?.brand).toBe('CarLab');
  });
});
