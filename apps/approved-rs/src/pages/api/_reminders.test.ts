import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { APIContext } from 'astro';
import { LEADS_PATH } from '@podbor/lead-crm';
import {
  createMemoryStorage,
  recordBotApi,
  type BotApiResponse,
  type MemoryStorage,
} from '@podbor/lead-crm/testing';
import type { StoredLead } from '@/lib/store';

const memory = vi.hoisted(() => {
  const storages = new Map<string, MemoryStorage>();
  return {
    storages,
    async module(name: string) {
      const { createMemoryStorage } = await import('@podbor/lead-crm/testing');
      const storageAt = ({ path }: { path: string }) => {
        if (!storages.has(path)) storages.set(path, createMemoryStorage());
        return storages.get(path)!;
      };
      return { [name]: storageAt };
    },
  };
});

vi.mock('@podbor/lead-crm/storage/vercel-blob', () =>
  memory.module('createVercelBlobStorage'),
);
vi.mock('@podbor/lead-crm/storage/file', () =>
  memory.module('createFileStorage'),
);

import { GET } from './reminders';
import { getLead } from '@/lib/store';

const api = recordBotApi();
vi.stubGlobal('fetch', api.fetch);

const SECRET = 'test-cron-secret';
const CRM_TOKEN = 'test-bot-token';
const OWNER_ID = 111;
const ADMIN_ID = 222;
const CARD_CHAT_ID = -100123;
const NOW = new Date('2026-10-20T08:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

function leadsStorage(): MemoryStorage {
  if (!memory.storages.has(LEADS_PATH))
    memory.storages.set(LEADS_PATH, createMemoryStorage());
  return memory.storages.get(LEADS_PATH)!;
}

function makeLead(overrides: Partial<StoredLead> = {}): StoredLead {
  return {
    id: 9,
    brand: 'Approved.rs',
    name: 'Иван',
    contact: '@ivan',
    service: 'vehicle-sourcing',
    services: ['vehicle-sourcing'],
    locale: 'ru',
    status: 'postponed',
    dealAmount: null,
    commissionPercent: 10,
    paidAmount: 0,
    incomes: [],
    payments: [],
    telegramChatId: CARD_CHAT_ID,
    telegramMessageId: 500 + (overrides.id ?? 9),
    statusChangedAt: '2026-10-01T00:00:00.000Z',
    lastActivityAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    pendingPrompt: null,
    capturePrompt: null,
    telegramId: null,
    referredBy: null,
    pendingCommissionClaim: null,
    remindAt: '2026-10-20',
    ...overrides,
  };
}

function ghost(overrides: Partial<StoredLead> = {}): StoredLead {
  return makeLead({
    id: 7,
    name: '',
    contact: '—',
    service: '',
    services: [],
    kind: 'call_click',
    contactChannel: 'whatsapp',
    status: 'open',
    remindAt: null,
    createdAt: new Date(NOW.getTime() - 25 * HOUR_MS).toISOString(),
    ...overrides,
  });
}

function makeCtx(
  headers: Record<string, string> = { authorization: `Bearer ${SECRET}` },
) {
  return {
    request: new Request('http://localhost/api/reminders', { headers }),
  } as Pick<APIContext, 'request'> as APIContext;
}

const crm = (method: string) =>
  api.callsTo(method, CRM_TOKEN).map((c) => c.payload);

const textsTo = (chatId: number) =>
  crm('sendMessage')
    .filter((p) => p.chat_id === chatId)
    .map((p) => p.text);

const cardEdits = (messageId: number) =>
  crm('editMessageText').filter(
    (p) => p.chat_id === CARD_CHAT_ID && p.message_id === messageId,
  );

async function stored(id: number): Promise<StoredLead> {
  const lead = await getLead(id);
  expect(lead).toBeDefined();
  return lead!;
}

describe('GET /api/reminders', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    api.reset();
    leadsStorage().seed([]);
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    ['no Authorization header', {}],
    ['the wrong bearer token', { authorization: 'Bearer wrong' }],
    ['a header missing the "Bearer " scheme', { authorization: SECRET }],
    ['a different auth scheme', { authorization: `Basic ${SECRET}` }],
    ['an empty Authorization header', { authorization: '' }],
    ['"Bearer " with no token after it', { authorization: 'Bearer ' }],
  ])('rejects %s without touching anything', async (_label, headers) => {
    leadsStorage().seed([makeLead(), ghost()]);
    const writes = leadsStorage().writeAttempts();

    const res = await GET(makeCtx(headers));

    expect(res.status).toBe(401);
    expect(api.calls).toEqual([]);
    expect(leadsStorage().writeAttempts()).toBe(writes);
  });

  it('reminds the owner on the day, reopens the lead and refreshes its card with the admin notice', async () => {
    leadsStorage().seed([makeLead()]);

    const res = await GET(makeCtx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      remindedPostponed: 1,
      expiredGhosts: 0,
    });
    expect(textsTo(OWNER_ID)).toEqual([
      expect.stringContaining('⏰ Напоминание по заявке #9'),
    ]);
    expect(await stored(9)).toMatchObject({
      status: 'open',
      remindAt: null,
      statusChangedAt: NOW.toISOString(),
    });
    expect(cardEdits(509)).toHaveLength(1);
    expect(textsTo(ADMIN_ID)).toEqual([expect.stringContaining('🔵 Открыта')]);
  });

  it('leaves a lead postponed to a later day alone', async () => {
    leadsStorage().seed([makeLead({ remindAt: '2026-10-21' })]);

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      remindedPostponed: 0,
      expiredGhosts: 0,
    });
    expect(api.calls).toEqual([]);
    expect((await stored(9)).status).toBe('postponed');
  });

  it('keeps a lead whose reminder could not be sent due, and still reminds the next one', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    leadsStorage().seed([makeLead({ id: 9 }), makeLead({ id: 10 })]);
    api.respond(
      'sendMessage',
      (payload: Record<string, unknown>): BotApiResponse =>
        String(payload.text).includes('#9')
          ? { ok: false, error_code: 403, description: 'Forbidden' }
          : {
              ok: true,
              result: {
                message_id: 1,
                date: 0,
                chat: { id: Number(payload.chat_id), type: 'private' },
              },
            },
    );

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      remindedPostponed: 1,
      expiredGhosts: 0,
    });
    expect((await stored(9)).status).toBe('postponed');
    expect((await stored(10)).status).toBe('open');
    error.mockRestore();
  });

  it('marks a Ghost lead lost and unpins its card, quietly and without an archive', async () => {
    leadsStorage().seed([ghost()]);

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      remindedPostponed: 0,
      expiredGhosts: 1,
    });
    const lead = await stored(7);
    expect(lead).toMatchObject({
      status: 'lost',
      statusChangedAt: NOW.toISOString(),
    });
    expect(lead).not.toHaveProperty('archived');
    expect(leadsStorage().current()).toEqual([
      expect.not.objectContaining({ archived: expect.anything() }),
    ]);
    expect(cardEdits(507)).toHaveLength(1);
    expect(crm('unpinChatMessage')).toEqual([
      { chat_id: CARD_CHAT_ID, message_id: 507 },
    ]);
    expect(textsTo(ADMIN_ID)).toEqual([]);
  });

  it('spares a click still inside its 24 hours and one the owner marked in work', async () => {
    leadsStorage().seed([
      ghost({
        id: 7,
        createdAt: new Date(NOW.getTime() - HOUR_MS).toISOString(),
      }),
      ghost({ id: 8, lastActivityAt: '2026-10-19T12:00:00.000Z' }),
    ]);

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      remindedPostponed: 0,
      expiredGhosts: 0,
    });
    expect((await stored(7)).status).toBe('open');
    expect((await stored(8)).status).toBe('open');
    expect(api.calls).toEqual([]);
  });

  it('still counts a swept ghost whose card refresh failed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    leadsStorage().seed([ghost({ id: 7 }), ghost({ id: 8 })]);
    api.fail('editMessageText', 'Bad Request: chat not found');

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      remindedPostponed: 0,
      expiredGhosts: 2,
    });
    expect((await stored(7)).status).toBe('lost');
    expect((await stored(8)).status).toBe('lost');
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});
