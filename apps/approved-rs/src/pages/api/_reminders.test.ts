import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { APIContext } from 'astro';
import { LEADS_PATH } from '@podbor/lead-crm';
import {
  createMemoryStorage,
  recordBotApi,
  type MemoryStorage,
} from '@podbor/lead-crm/testing';
import type { StoredLead } from '@/lib/store';
import { settleKeyboard } from '@/lib/telegram';

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
import { addPayout, getLead, touchLead } from '@/lib/store';

const api = recordBotApi();
vi.stubGlobal('fetch', api.fetch);

const SECRET = 'test-cron-secret';
const CRM_TOKEN = 'test-bot-token';
const OWNER_ID = 111;
const ADMIN_ID = 222;
const CARD_CHAT_ID = -100123;
const NOW = new Date('2026-10-20T08:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const GROUP_ID = '-1009876543210';

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
    telegramChatId: CARD_CHAT_ID,
    telegramMessageId: 500 + (overrides.id ?? 9),
    statusChangedAt: '2026-10-01T00:00:00.000Z',
    lastActivityAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    pendingPrompt: null,
    capturePrompt: null,
    telegramId: null,
    referredBy: null,
    remindAt: '2026-10-20',
    ...overrides,
  };
}

function ghost(overrides: Partial<StoredLead> = {}): StoredLead {
  const createdAt =
    overrides.createdAt ?? new Date(NOW.getTime() - 25 * HOUR_MS).toISOString();
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
    createdAt,
    statusChangedAt: createdAt,
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

const digestIds = () =>
  crm('sendMessage')
    .filter((p) => p.chat_id === GROUP_ID)
    .flatMap((p) => [...String(p.text).matchAll(/>#(\d+)</g)])
    .map((m) => Number(m[1]));

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

  it('posts one digest to the group: due postponed, won without a Payout, idle for 7 days', async () => {
    leadsStorage().seed([
      makeLead({ id: 9 }),
      makeLead({ id: 10, status: 'won' }),
      makeLead({
        id: 11,
        status: 'open',
        remindAt: null,
        lastActivityAt: '2026-10-13T08:00:00.000Z',
      }),
      makeLead({
        id: 12,
        status: 'open',
        remindAt: null,
        lastActivityAt: '2026-10-14T08:00:00.000Z',
      }),
    ]);

    const res = await GET(makeCtx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      expiredGhosts: 0,
      digestSent: true,
      monthlySummary: false,
    });
    const [digest] = crm('sendMessage');
    expect(crm('sendMessage')).toHaveLength(1);
    expect(digest).toMatchObject({ chat_id: GROUP_ID });
    expect(digest.text).toContain('⏰ Пора вернуться');
    expect(digest.text).toContain('💶 Сделка без суммы');
    expect(digest.text).toContain('🕐 Без движения 7 дней');
    expect(digestIds()).toEqual([9, 10, 11]);
    expect(digest.reply_markup).toEqual({
      inline_keyboard: [9, 10, 11].map((id) => [
        { text: `✅ #${id}`, callback_data: `won:${id}` },
        { text: `❌ #${id}`, callback_data: `lost:${id}` },
        { text: `⏳ #${id}`, callback_data: `work:${id}` },
      ]),
    });
    expect(textsTo(OWNER_ID)).toEqual([]);
    expect(textsTo(ADMIN_ID)).toEqual([]);
  });

  it('reopens a due postponed Lead once it is listed, starting its clock again', async () => {
    leadsStorage().seed([makeLead()]);

    await GET(makeCtx());

    expect(await stored(9)).toMatchObject({
      status: 'open',
      remindAt: null,
      statusChangedAt: NOW.toISOString(),
    });
    expect(cardEdits(509)).toHaveLength(1);

    api.reset();
    vi.setSystemTime(new Date(NOW.getTime() + DAY_MS));
    const next = await GET(makeCtx());
    expect(await next.json()).toEqual({
      expiredGhosts: 0,
      digestSent: false,
      monthlySummary: false,
    });
    expect(api.calls).toEqual([]);
  });

  it('posts nothing when no Lead needs a decision', async () => {
    leadsStorage().seed([
      makeLead({ remindAt: '2026-10-21' }),
      makeLead({ id: 10, status: 'open', remindAt: null }),
      makeLead({ id: 11, status: 'lost', remindAt: null }),
      makeLead({ id: 12, status: 'won', remindAt: null }),
    ]);
    await addPayout({ amount: 0, by: 'owner', leadId: 12 });

    vi.setSystemTime(new Date('2026-10-07T08:00:00.000Z'));
    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 0,
      digestSent: false,
      monthlySummary: false,
    });
    expect(api.calls).toEqual([]);
    expect((await stored(9)).status).toBe('postponed');
  });

  it('drops a Lead from the digest once ⏳ resets its clock', async () => {
    leadsStorage().seed([makeLead({ status: 'open', remindAt: null })]);

    await GET(makeCtx());
    expect(digestIds()).toEqual([9]);

    api.reset();
    await touchLead(9);
    vi.setSystemTime(new Date(NOW.getTime() + 6 * DAY_MS));
    await GET(makeCtx());
    expect(api.calls).toEqual([]);

    vi.setSystemTime(new Date(NOW.getTime() + 7 * DAY_MS));
    await GET(makeCtx());
    expect(digestIds()).toEqual([9]);
  });

  it('expires an old Ghost instead of listing it as idle', async () => {
    leadsStorage().seed([
      ghost({ createdAt: '2026-10-01T00:00:00.000Z' }),
      makeLead({ id: 10, status: 'open', remindAt: null }),
    ]);

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 1,
      digestSent: true,
      monthlySummary: false,
    });
    expect((await stored(7)).status).toBe('lost');
    expect(digestIds()).toEqual([10]);
  });

  it('keeps a due Lead postponed when the digest could not be sent', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    leadsStorage().seed([makeLead()]);
    api.fail('sendMessage', 'Forbidden: bot was kicked', 403);

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 0,
      digestSent: false,
      monthlySummary: false,
    });
    expect((await stored(9)).status).toBe('postponed');
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('still lists the rest when reopening one due Lead fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    leadsStorage().seed([makeLead({ id: 9 }), makeLead({ id: 10 })]);
    api.fail('editMessageText', 'Bad Request: chat not found');

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 0,
      digestSent: true,
      monthlySummary: false,
    });
    expect((await stored(9)).status).toBe('open');
    expect((await stored(10)).status).toBe('open');
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('marks a Ghost lead lost and unpins its card, quietly and without an archive', async () => {
    leadsStorage().seed([ghost()]);

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 1,
      digestSent: false,
      monthlySummary: false,
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
      expiredGhosts: 0,
      digestSent: false,
      monthlySummary: false,
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
      expiredGhosts: 2,
      digestSent: false,
      monthlySummary: false,
    });
    expect((await stored(7)).status).toBe('lost');
    expect((await stored(8)).status).toBe('lost');
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  describe('monthly summary', () => {
    const NOV_1 = new Date('2026-11-01T08:00:00.000Z');
    const posted = () =>
      crm('sendMessage').filter((p) => p.chat_id === GROUP_ID);
    const summaries = () =>
      (leadsStorage().current() as { type?: string }[]).filter(
        (r) => r.type === 'summary',
      );

    beforeEach(() => {
      vi.setSystemTime(NOV_1);
      leadsStorage().seed([
        makeLead({ id: 9, remindAt: '2026-12-01' }),
        makeLead({ id: 10, status: 'won', remindAt: null }),
        {
          type: 'payout',
          id: 1,
          amount: 80,
          createdAt: '2026-10-15T10:00:00.000Z',
          createdBy: 'owner',
          leadId: 10,
        },
      ]);
    });

    it('posts the balance, the Payouts and the Leads without an outcome to the group on the 1st', async () => {
      const res = await GET(makeCtx());

      expect(await res.json()).toEqual({
        expiredGhosts: 0,
        digestSent: false,
        monthlySummary: true,
      });
      expect(posted()).toEqual([
        expect.objectContaining({ reply_markup: settleKeyboard(80) }),
      ]);
      const text = String(posted()[0]!.text);
      expect(text).toContain('💶 К оплате: 80 €');
      expect(text).toContain('#10');
      expect(text).toContain('<b>Без итога: 1</b>\n• #9 Иван');
      expect(summaries()).toEqual([
        expect.objectContaining({ month: '2026-11' }),
      ]);
    });

    it('expires Ghosts, then posts the digest, then the summary', async () => {
      leadsStorage().seed([
        ghost({ createdAt: '2026-10-01T00:00:00.000Z' }),
        makeLead({ id: 9, status: 'open', remindAt: null }),
      ]);

      const res = await GET(makeCtx());

      expect(await res.json()).toEqual({
        expiredGhosts: 1,
        digestSent: true,
        monthlySummary: true,
      });
      const [digest, summary] = posted().map((p) => String(p.text));
      expect(posted()).toHaveLength(2);
      expect(digest).toContain('🕐 Без движения 7 дней');
      expect(summary).toContain('<b>Без итога: 1</b>\n• #9 Иван');
      expect(summary).not.toContain('#7');
    });

    it('posts once a month, however often the cron runs', async () => {
      await GET(makeCtx());
      vi.setSystemTime(new Date('2026-11-01T20:00:00.000Z'));
      const res = await GET(makeCtx());

      expect((await res.json()).monthlySummary).toBe(false);
      expect(posted()).toHaveLength(1);
      expect(summaries()).toHaveLength(1);
    });

    it('stays quiet on the 2nd', async () => {
      vi.setSystemTime(new Date('2026-11-02T08:00:00.000Z'));
      const res = await GET(makeCtx());

      expect((await res.json()).monthlySummary).toBe(false);
      expect(api.calls).toEqual([]);
      expect(summaries()).toEqual([]);
    });

    it('gives the month back when the post fails, so the next run sends it', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.fail('sendMessage', 'Bad Request: chat not found');
      const failed = await GET(makeCtx());

      expect((await failed.json()).monthlySummary).toBe(false);
      expect(summaries()).toEqual([]);
      expect(error).toHaveBeenCalledOnce();

      api.reset();
      const retried = await GET(makeCtx());
      expect((await retried.json()).monthlySummary).toBe(true);
      expect(posted()).toHaveLength(1);
      error.mockRestore();
    });
  });
});
