import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBrandStore } from './brandStore.ts';
import { createBrandBot } from './brandBot.ts';
import { LEADS_PATH, QUARANTINE_PATH } from './quarantine.ts';
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
const storageFor = (path: string) => (storages[path] = createMemoryStorage());

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
    expect(Object.keys(storages)).toEqual([LEADS_PATH, QUARANTINE_PATH]);
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
