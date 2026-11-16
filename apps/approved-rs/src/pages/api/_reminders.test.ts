import '@podbor/lead-crm/testing/database';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { APIContext } from 'astro';
import { crmDatabase } from '@podbor/lead-crm';
import { recordBotApi, seedLead } from '@podbor/lead-crm/testing';
import type { StoredLead } from '@/lib/store';

import { GET } from './reminders';
import { POST as webhook } from './telegram-webhook';
import { getLead, readLeads, touchLead } from '@/lib/store';

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

const L = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const numberOf = (id: string) => Number(id.slice(-12));

async function seed(leads: StoredLead[]): Promise<void> {
  await crmDatabase().lead.deleteMany();
  for (const lead of leads) await seedLead(lead);
}

function makeLead(overrides: Partial<StoredLead> = {}): StoredLead {
  return {
    id: L(9),
    brand: 'Approved.rs',
    name: 'Иван',
    contact: '@ivan',
    service: 'vehicle-sourcing',
    services: ['vehicle-sourcing'],
    locale: 'ru',
    status: 'postponed',
    telegramChatId: CARD_CHAT_ID,
    telegramMessageId: 500 + numberOf(overrides.id ?? L(9)),
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
    id: L(7),
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
    .flatMap((p) => [...String(p.text).matchAll(/>#([0-9a-f-]{36})</g)])
    .map((m) => m[1]);

const textsTo = (chatId: number) =>
  crm('sendMessage')
    .filter((p) => p.chat_id === chatId)
    .map((p) => p.text);

const cardEdits = (messageId: number) =>
  crm('editMessageText').filter(
    (p) => p.chat_id === CARD_CHAT_ID && p.message_id === messageId,
  );

async function stored(n: number): Promise<StoredLead> {
  const lead = await getLead(L(n));
  expect(lead).toBeDefined();
  return lead!;
}

describe('GET /api/reminders', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    api.reset();
    await seed([]);
  });

  afterEach(() => vi.useRealTimers());

  it('fails loudly when CRON_SECRET is unset rather than refusing every run', async () => {
    vi.stubEnv('CRON_SECRET', '');

    await expect(GET(makeCtx())).rejects.toThrow('CRON_SECRET is not set');
    vi.unstubAllEnvs();
  });

  it.each([
    ['no Authorization header', {}],
    ['the wrong bearer token', { authorization: 'Bearer wrong' }],
    ['a header missing the "Bearer " scheme', { authorization: SECRET }],
    ['a different auth scheme', { authorization: `Basic ${SECRET}` }],
    ['an empty Authorization header', { authorization: '' }],
    ['"Bearer " with no token after it', { authorization: 'Bearer ' }],
  ])('rejects %s without touching anything', async (_label, headers) => {
    await seed([makeLead(), ghost()]);
    const writes = await readLeads();

    const res = await GET(makeCtx(headers));

    expect(res.status).toBe(401);
    expect(api.calls).toEqual([]);
    expect(await readLeads()).toEqual(writes);
  });

  it('posts one digest to the group: due postponed and idle for 7 days, never won ones', async () => {
    await seed([
      makeLead({ id: L(9) }),
      makeLead({ id: L(10), status: 'won' }),
      makeLead({
        id: L(11),
        status: 'new',
        remindAt: null,
        lastActivityAt: '2026-10-13T08:00:00.000Z',
      }),
      makeLead({
        id: L(12),
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
    expect(digestIds()).toEqual([L(9), L(11)]);
    expect(digest.reply_markup).toBeUndefined();
    expect(textsTo(OWNER_ID)).toEqual([expect.stringContaining(`#${L(9)}`)]);
    expect(textsTo(ADMIN_ID)).toEqual([]);
  });

  it('reopens a due postponed Lead once it is listed, starting its clock again', async () => {
    await seed([makeLead()]);

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
      await seed([makeLead({ postponedFrom: status })]);

      await GET(makeCtx());

      expect(await stored(9)).toMatchObject({
        status,
        postponedFrom: null,
        remindAt: null,
      });
      const [reminder] = crm('sendMessage').filter(
        (p) => p.chat_id === OWNER_ID,
      );
      expect(reminder.text).toContain(`⏰ Напоминание по заявке #${L(9)}`);
      expect(reminder.text).toContain(
        'Ты просил напомнить сегодня — заявка снова активна.',
      );
      expect(reminder.reply_markup).toEqual({
        inline_keyboard: [
          [{ text: '📂 Открыть заявку', callback_data: `open:${L(9)}` }],
        ],
      });
    },
  );

  it('posts nothing when no Lead needs a decision', async () => {
    await seed([
      makeLead({ remindAt: '2026-10-21' }),
      makeLead({ id: L(10), status: 'new', remindAt: null }),
      makeLead({ id: L(11), status: 'lost', remindAt: null }),
      makeLead({ id: L(12), status: 'won', remindAt: null }),
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
    await seed([makeLead({ status: 'new', remindAt: null })]);

    await GET(makeCtx());
    expect(digestIds()).toEqual([L(9)]);

    api.reset();
    await touchLead(L(9));
    vi.setSystemTime(new Date(NOW.getTime() + 6 * DAY_MS));
    await GET(makeCtx());
    expect(api.calls).toEqual([]);

    vi.setSystemTime(new Date(NOW.getTime() + 7 * DAY_MS));
    await GET(makeCtx());
    expect(digestIds()).toEqual([L(9)]);
  });

  it('expires an old Ghost instead of listing it as idle', async () => {
    await seed([
      ghost({ createdAt: '2026-10-01T00:00:00.000Z' }),
      makeLead({ id: L(10), status: 'new', remindAt: null }),
    ]);

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 1,
      closedTopics: 0,
      digestSent: true,
    });
    expect((await stored(7)).status).toBe('lost');
    expect(digestIds()).toEqual([L(10)]);
  });

  it('keeps a due Lead postponed when the digest could not be sent', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await seed([makeLead()]);
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
    await seed([makeLead({ status: 'new', remindAt: null })]);

    await GET(makeCtx());
    vi.setSystemTime(new Date(NOW.getTime() + 2 * HOUR_MS));
    const rerun = await GET(makeCtx());

    expect((await rerun.json()).digestSent).toBe(false);
    expect(digestIds()).toEqual([L(9)]);

    api.reset();
    vi.setSystemTime(new Date(NOW.getTime() + DAY_MS));
    await GET(makeCtx());
    expect(digestIds()).toEqual([L(9)]);
  });

  it('gives the day back when the digest fails, so the next run sends it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await seed([makeLead()]);
    api.fail('sendMessage', 'Bad Request: chat not found');
    await GET(makeCtx());

    api.reset();
    const retried = await GET(makeCtx());

    expect((await retried.json()).digestSent).toBe(true);
    expect(digestIds()).toEqual([L(9)]);
    error.mockRestore();
  });

  it('still lists the rest when reopening one due Lead fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await seed([makeLead({ id: L(9) }), makeLead({ id: L(10) })]);
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
    await seed([ghost()]);

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
    expect(cardEdits(507)).toHaveLength(1);
    expect(crm('unpinChatMessage')).toEqual([
      { chat_id: CARD_CHAT_ID, message_id: 507 },
    ]);
    expect(textsTo(ADMIN_ID)).toEqual([]);
  });

  it('spares a click still inside its 24 hours and one the owner marked in work', async () => {
    await seed([
      ghost({
        id: L(7),
        createdAt: new Date(NOW.getTime() - HOUR_MS).toISOString(),
      }),
      ghost({ id: L(8), lastActivityAt: '2026-10-19T12:00:00.000Z' }),
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
    await seed([ghost({ id: L(7) }), ghost({ id: L(8) })]);
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
        id: L(id),
        contact,
        kind: 'lead',
        contactChannel: 'telegram',
        telegramId: 40 + id,
        createdAt: '2026-10-01T00:00:00.000Z',
      });
    await seed([
      ghost({ id: L(6), createdAt: '2026-10-01T00:00:00.000Z' }),
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
    expect(digestIds()).toEqual([L(7), L(8), L(10)]);
  });

  it('spares a click the owner gave a contact to in the bot', async () => {
    await seed([ghost({ createdAt: '2026-10-01T00:00:00.000Z' })]);
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
          data: `edit:${L(7)}:contact`,
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

  it('redraws the digest whenever a listed Lead is decided on, until all is sorted', async () => {
    await seed([
      makeLead({ id: L(9), status: 'new', remindAt: null }),
      makeLead({
        id: L(11),
        status: 'new',
        remindAt: null,
        telegramMessageId: 511,
      }),
    ]);
    await GET(makeCtx());
    const digestId = (await crmDatabase().digest.findFirstOrThrow()).messageId;
    const tap = async (data: string, updateId: number) => {
      api.reset();
      await webhook({
        request: new Request('http://localhost/api/telegram-webhook', {
          method: 'POST',
          headers: { 'x-telegram-bot-api-secret-token': 'test-webhook-secret' },
          body: JSON.stringify({
            update_id: updateId,
            callback_query: {
              id: 'cb',
              data,
              from: { id: ADMIN_ID },
              message: {
                message_id: 4321,
                chat: { id: ADMIN_ID },
                text: 'card',
              },
            },
          }),
        }),
      } as Pick<APIContext, 'request'> as APIContext);
      return crm('editMessageText').find((p) => p.message_id === digestId);
    };

    const first = await tap(`st:${L(9)}:lost`, 71001);
    expect((await stored(9)).status).toBe('lost');
    expect(first).toMatchObject({ chat_id: GROUP_ID });
    expect(first!.text).not.toContain(`#${L(9)}<`);
    expect(first!.text).toContain(`#${L(11)}<`);
    expect(first!.reply_markup).toBeUndefined();

    const last = await tap(`work:${L(11)}`, 71002);
    expect((await stored(11)).status).toBe('in_progress');
    expect(last!.text).toContain('✅ Всё разобрано');

    expect(await tap(`won:${L(11)}`, 71003)).toBeUndefined();
  });

  describe('topics nobody wrote in for a day', () => {
    const emptyTopic = (id: number, openedMsAgo: number) =>
      makeLead({
        id: L(id),
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
      await seed([emptyTopic(7, DAY_MS), emptyTopic(8, DAY_MS - 1)]);

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
      await seed([emptyTopic(7, DAY_MS)]);
      api.fail('closeForumTopic', 'Bad Request: TOPIC_CLOSED');

      const res = await GET(makeCtx());

      expect(await res.json()).toMatchObject({ closedTopics: 1 });
      expect((await stored(7)).topicClosed).toBe(true);
    });

    it('logs a topic it could not close and tries it again on the next run', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      await seed([emptyTopic(7, DAY_MS), emptyTopic(8, DAY_MS)]);
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
      await seed([
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
    await seed([makeLead({ id: L(9), status: 'new', remindAt: null })]);

    const res = await GET(makeCtx());

    expect(await res.json()).toEqual({
      expiredGhosts: 0,
      closedTopics: 0,
      digestSent: true,
    });
    const posted = crm('sendMessage');
    expect(posted).toHaveLength(1);
    expect(String(posted[0]!.text)).not.toContain('Итоги месяца');
    expect(await crmDatabase().digest.count()).toBe(1);
    expect(textsTo(ADMIN_ID)).toEqual([]);
  });
});
