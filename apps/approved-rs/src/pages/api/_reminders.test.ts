import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { APIContext } from 'astro';
import { LEADS_PATH } from '@podbor/lead-crm';
import {
  createMemoryStorage,
  recordBotApi,
  type MemoryStorage,
} from '@podbor/lead-crm/testing';
import type { StoredLead } from '@/lib/store';

const memory = vi.hoisted(() => {
  const storages = new Map<string, MemoryStorage>();
  return {
    storages,
    async module(name: string) {
      const { createMemoryStorage } = await import('@podbor/lead-crm/testing');
      const storageAt = (path: string) => {
        if (!storages.has(path)) storages.set(path, createMemoryStorage());
        return storages.get(path)!;
      };
      return { [name]: storageAt };
    },
  };
});

vi.mock('@podbor/lead-crm/storage/local', () =>
  memory.module('localLeadStorage'),
);

import { GET } from './reminders';
import { POST as webhook } from './telegram-webhook';
import { getLead, touchLead } from '@/lib/store';

const api = recordBotApi();
vi.stubGlobal('fetch', api.fetch);

const SECRET = 'test-cron-secret';
const CRM_TOKEN = '1001:test-bot-token';
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
    topicId: null,
    topicMessageId: null,
    topicClosed: false,
    topicActiveAt: null,
    questionnaireDone: false,
    referredBy: null,
    managerHandoff: null,
    adSource: null,
    metaIds: null,
    metaLeadSentAt: null,
    remindAt: '2026-10-20',
    postponedFrom: null,
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
    status: 'new',
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

  it('posts one digest to the group: due postponed and idle for 7 days, never won ones', async () => {
    leadsStorage().seed([
      makeLead({ id: 9 }),
      makeLead({ id: 10, status: 'won' }),
      makeLead({
        id: 11,
        status: 'new',
        remindAt: null,
        lastActivityAt: '2026-10-13T08:00:00.000Z',
      }),
      makeLead({
        id: 12,
        status: 'new',
        remindAt: null,
        lastActivityAt: '2026-10-14T08:00:00.000Z',
      }),
    ]);

    const res = await GET(makeCtx());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      expiredGhosts: 0,
      closedTopics: 0,
      digestSent: true,
    });
    const [digest] = crm('sendMessage');
    expect(crm('sendMessage')).toHaveLength(2);
    expect(digest).toMatchObject({ chat_id: GROUP_ID });
    expect(digest.text).toContain('⏰ Пора вернуться');
    expect(digest.text).not.toContain('💶');
    expect(digest.text).toContain('🕐 Без движения 7 дней');
    expect(digestIds()).toEqual([9, 11]);
    expect(digest.reply_markup).toEqual({
      inline_keyboard: [9, 11].map((id) => [
        { text: `✅ #${id}`, callback_data: `won:${id}` },
        { text: `❌ #${id}`, callback_data: `lost:${id}` },
        { text: `🔵 #${id}`, callback_data: `work:${id}` },
      ]),
    });
    expect(textsTo(OWNER_ID)).toEqual([expect.stringContaining('#9')]);
    expect(textsTo(ADMIN_ID)).toEqual([]);
  });

  it('reopens a due postponed Lead once it is listed, starting its clock again', async () => {
    leadsStorage().seed([makeLead()]);

    await GET(makeCtx());

    expect(await stored(9)).toMatchObject({
      status: 'new',
      remindAt: null,
      statusChangedAt: NOW.toISOString(),
    });
    expect(cardEdits(509)).toHaveLength(1);

    api.reset();
    vi.setSystemTime(new Date(NOW.getTime() + 2 * HOUR_MS));
    await GET(makeCtx());
    expect(api.calls).toEqual([]);

    api.reset();
    vi.setSystemTime(new Date(NOW.getTime() + DAY_MS));
    const next = await GET(makeCtx());
    expect(await next.json()).toEqual({
      expiredGhosts: 0,
      closedTopics: 0,
      digestSent: false,
    });
    expect(api.calls).toEqual([]);
  });

  it.each(['new', 'negotiations', 'in_progress'] as const)(
    'returns a due Lead postponed from %s to it and reminds the owner in a DM',
    async (status) => {
      leadsStorage().seed([makeLead({ postponedFrom: status })]);

      await GET(makeCtx());

      expect(await stored(9)).toMatchObject({
        status,
        postponedFrom: null,
        remindAt: null,
      });
      const [reminder] = crm('sendMessage').filter(
        (p) => p.chat_id === OWNER_ID,
      );
      expect(reminder.text).toContain('⏰ Напоминание по заявке #9');
      expect(reminder.text).toContain(
        'Ты просил напомнить сегодня — заявка снова активна.',
      );
      expect(reminder.reply_markup).toEqual({
        inline_keyboard: [
          [{ text: '📂 Открыть заявку', callback_data: 'open:9' }],
        ],
      });
    },
  );

  it('posts nothing when no Lead needs a decision', async () => {
    leadsStorage().seed([
      makeLead({ remindAt: '2026-10-21' }),
      makeLead({ id: 10, status: 'new', remindAt: null }),
      makeLead({ id: 11, status: 'lost', remindAt: null }),
      makeLead({ id: 12, status: 'won', remindAt: null }),
    ]);

    vi.setSystemTime(new Date('2026-10-07T08:00:00.000Z'));
    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 0,
      closedTopics: 0,
      digestSent: false,
    });
    expect(api.calls).toEqual([]);
    expect((await stored(9)).status).toBe('postponed');
  });

  it('drops a Lead from the digest once 🔵 resets its clock', async () => {
    leadsStorage().seed([makeLead({ status: 'new', remindAt: null })]);

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
      makeLead({ id: 10, status: 'new', remindAt: null }),
    ]);

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 1,
      closedTopics: 0,
      digestSent: true,
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
      closedTopics: 0,
      digestSent: false,
    });
    expect((await stored(9)).status).toBe('postponed');
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('posts the digest once a day, however often the cron runs', async () => {
    leadsStorage().seed([makeLead({ status: 'new', remindAt: null })]);

    await GET(makeCtx());
    vi.setSystemTime(new Date(NOW.getTime() + 2 * HOUR_MS));
    const rerun = await GET(makeCtx());

    expect((await rerun.json()).digestSent).toBe(false);
    expect(digestIds()).toEqual([9]);

    api.reset();
    vi.setSystemTime(new Date(NOW.getTime() + DAY_MS));
    await GET(makeCtx());
    expect(digestIds()).toEqual([9]);
  });

  it('gives the day back when the digest fails, so the next run sends it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    leadsStorage().seed([makeLead()]);
    api.fail('sendMessage', 'Bad Request: chat not found');
    await GET(makeCtx());

    api.reset();
    const retried = await GET(makeCtx());

    expect((await retried.json()).digestSent).toBe(true);
    expect(digestIds()).toEqual([9]);
    error.mockRestore();
  });

  it('still lists the rest when reopening one due Lead fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    leadsStorage().seed([makeLead({ id: 9 }), makeLead({ id: 10 })]);
    api.fail('editMessageText', 'Bad Request: chat not found');

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 0,
      closedTopics: 0,
      digestSent: true,
    });
    expect((await stored(9)).status).toBe('new');
    expect((await stored(10)).status).toBe('new');
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('marks a Ghost lead lost and unpins its card, quietly and without an archive', async () => {
    leadsStorage().seed([ghost()]);

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 1,
      closedTopics: 0,
      digestSent: false,
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
      closedTopics: 0,
      digestSent: false,
    });
    expect((await stored(7)).status).toBe('new');
    expect((await stored(8)).status).toBe('new');
    expect(api.calls).toEqual([]);
  });

  it('still counts a swept ghost whose card refresh failed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    leadsStorage().seed([ghost({ id: 7 }), ghost({ id: 8 })]);
    api.fail('editMessageText', 'Bad Request: chat not found');

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 2,
      closedTopics: 0,
      digestSent: false,
    });
    expect((await stored(7)).status).toBe('lost');
    expect((await stored(8)).status).toBe('lost');
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('retires a placeholder click and never a capture-bot Lead, even a bare /start', async () => {
    const start = (id: number, contact: string) =>
      ghost({
        id,
        contact,
        kind: 'lead',
        contactChannel: 'telegram',
        telegramId: 40 + id,
        createdAt: '2026-10-01T00:00:00.000Z',
      });
    leadsStorage().seed([
      ghost({ id: 6, createdAt: '2026-10-01T00:00:00.000Z' }),
      start(7, 'tg://user?id=47'),
      start(8, '+381601234567'),
      start(10, '@ivan'),
    ]);

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 1,
      closedTopics: 0,
      digestSent: true,
    });
    expect((await stored(6)).status).toBe('lost');
    for (const id of [7, 8, 10]) expect((await stored(id)).status).toBe('new');
    expect(digestIds()).toEqual([7, 8, 10]);
  });

  it('spares a click the owner gave a contact to in the bot', async () => {
    leadsStorage().seed([ghost({ createdAt: '2026-10-01T00:00:00.000Z' })]);
    api.respond('sendMessage', (payload: Record<string, unknown>) => ({
      ok: true,
      result: {
        message_id: 900,
        date: 0,
        chat: { id: Number(payload.chat_id), type: 'private' },
      },
    }));
    const update = (body: Record<string, unknown>, updateId: number) =>
      webhook({
        request: new Request('http://localhost/api/telegram-webhook', {
          method: 'POST',
          headers: { 'x-telegram-bot-api-secret-token': 'test-webhook-secret' },
          body: JSON.stringify({ update_id: updateId, ...body }),
        }),
      } as Pick<APIContext, 'request'> as APIContext);
    const dm = { id: OWNER_ID, type: 'private' };
    await update(
      {
        callback_query: {
          id: 'cb',
          data: 'edit:7:contact',
          from: { id: OWNER_ID },
          message: { message_id: 1, chat: dm },
        },
      },
      70001,
    );
    await update(
      {
        message: {
          message_id: 2,
          text: '+381 64 123 4567',
          chat: dm,
          from: { id: OWNER_ID },
          reply_to_message: { message_id: 900 },
        },
      },
      70002,
    );
    expect((await stored(7)).contact).toBe('+381641234567');
    api.reset();

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 0,
      closedTopics: 0,
      digestSent: false,
    });
    expect((await stored(7)).status).toBe('new');
  });

  describe('topics nobody wrote in for a day', () => {
    const emptyTopic = (id: number, openedMsAgo: number) =>
      makeLead({
        id,
        status: 'new',
        remindAt: null,
        createdAt: new Date(NOW.getTime() - openedMsAgo).toISOString(),
        statusChangedAt: NOW.toISOString(),
        telegramId: 40 + id,
        topicId: 300 + id,
        topicMessageId: 400 + id,
        topicActiveAt: null,
      });

    it('closes an empty topic once and leaves a younger one open', async () => {
      leadsStorage().seed([emptyTopic(7, DAY_MS), emptyTopic(8, DAY_MS - 1)]);

      const res = await GET(makeCtx());

      expect(await res.json()).toEqual({
        expiredGhosts: 0,
        closedTopics: 1,
        digestSent: false,
      });
      expect(crm('closeForumTopic')).toEqual([
        { chat_id: GROUP_ID, message_thread_id: 307 },
      ]);
      expect(await stored(7)).toMatchObject({
        topicClosed: true,
        status: 'new',
      });
      expect((await stored(8)).topicClosed).toBe(false);

      api.reset();
      const again = await GET(makeCtx());

      expect(await again.json()).toMatchObject({ closedTopics: 0 });
      expect(crm('closeForumTopic')).toEqual([]);
    });

    it('counts a topic Telegram already had closed', async () => {
      leadsStorage().seed([emptyTopic(7, DAY_MS)]);
      api.fail('closeForumTopic', 'Bad Request: TOPIC_CLOSED');

      const res = await GET(makeCtx());

      expect(await res.json()).toMatchObject({ closedTopics: 1 });
      expect((await stored(7)).topicClosed).toBe(true);
    });

    it('logs a topic it could not close and tries it again on the next run', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      leadsStorage().seed([emptyTopic(7, DAY_MS), emptyTopic(8, DAY_MS)]);
      api.fail('closeForumTopic', 'Bad Request: not enough rights');

      const res = await GET(makeCtx());

      expect(await res.json()).toMatchObject({ closedTopics: 0 });
      expect(crm('closeForumTopic')).toHaveLength(2);
      expect(error).toHaveBeenCalledTimes(2);
      expect((await stored(7)).topicClosed).toBe(false);
      error.mockRestore();

      api.reset();
      const again = await GET(makeCtx());

      expect(await again.json()).toMatchObject({ closedTopics: 2 });
      expect((await stored(8)).topicClosed).toBe(true);
    });

    it('never closes a topic with a conversation in it, however long it is quiet', async () => {
      leadsStorage().seed([
        {
          ...emptyTopic(7, 14 * DAY_MS),
          topicActiveAt: new Date(NOW.getTime() - 14 * DAY_MS).toISOString(),
        },
      ]);

      const res = await GET(makeCtx());

      expect(await res.json()).toMatchObject({ closedTopics: 0 });
      expect(crm('closeForumTopic')).toEqual([]);
    });
  });

  it('posts no monthly summary on the 1st', async () => {
    vi.setSystemTime(new Date('2026-11-01T08:00:00.000Z'));
    leadsStorage().seed([makeLead({ id: 9, status: 'new', remindAt: null })]);

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 0,
      closedTopics: 0,
      digestSent: true,
    });
    const posted = crm('sendMessage');
    expect(posted).toHaveLength(1);
    expect(String(posted[0]!.text)).not.toContain('Итоги месяца');
    expect(
      (leadsStorage().current() as { type?: string }[]).map(
        (r) => r.type ?? 'lead',
      ),
    ).toEqual(['lead', 'digest']);
    expect(textsTo(ADMIN_ID)).toEqual([]);
  });
});
