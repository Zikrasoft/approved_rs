import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { businessDay, crmDatabase, leadIdSchema } from '@podbor/lead-crm';
import {
  recordBotApi,
  seedLead,
  type BotApiResponse,
} from '@podbor/lead-crm/testing';
import type { StoredLead } from '@/lib/store';

vi.hoisted(() => {
  process.env.TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB =
    '1003:test-carlab-capture-token';
  process.env.SHOP_API_URL = 'https://shop.test';
  process.env.SHOP_VISITOR_SEARCHES_SECRET = 'test-visitor-searches-secret';
});

vi.mock('@/lib/store', async (original) => {
  const actual = await original<typeof import('@/lib/store')>();
  return { ...actual, setStatus: vi.fn(actual.setStatus) };
});

import { POST, CALLBACKS } from './telegram-webhook';
import {
  buildDeleteConfirm,
  buildHelp,
  buildLeadDetail,
  buildOpenList,
  buildMenu,
  buildBalance,
  formatMoney,
  LEAD_ACTION_COPY,
  LEDGER_COPY,
  operationRecordedText,
  operationRefusedText,
  reAskOperationText,
  buildRemindPicker,
  buildSearchResults,
  EDIT_COPY,
  extraContactNote,
  reAskEditText,
  REPLY_COPY,
} from '@/lib/telegram';
import {
  getLead,
  readLeads,
  searchLeads,
  readBalance,
  readOperations,
  setStatus,
} from '@/lib/store';
import { ledgerStore } from '@/lib/crm';

const api = recordBotApi();
const VISITOR = '0f8fad5b-d9cb-469f-a165-70867728950e';
const shopFetch = vi.fn((url: string | URL | Request, init?: RequestInit) =>
  String(url) === `https://shop.test/hooks/visitors/${VISITOR}/vin-lookups`
    ? Promise.resolve(
        Response.json({
          lookups: [
            {
              make: 'BMW',
              model: '116d E81',
              vin_last4: '1234',
              at: '2026-11-10T09:00:00.000Z',
              vehicle: null,
            },
          ],
        }),
      )
    : api.fetch(url, init),
);
vi.stubGlobal('fetch', shopFetch);

const SECRET = 'test-webhook-secret';
const CRM_TOKEN = '1001:test-bot-token';
const APPROVED_CAPTURE_TOKEN = '1002:test-capture-bot-token';
const CARLAB_CAPTURE_TOKEN = '1003:test-carlab-capture-token';
const GROUP_ID = '-1009876543210';
const OWNER_ID = 111;
const ADMIN_ID = 222;
const OTHER_ID = 999;
const DM_CHAT_ID = 111;
const CARD_CHAT_ID = -100123;
const CARD_MESSAGE_ID = 555;
const PROMPT_ID = 888;
const LATER = '20.10.2099';

let nextUpdateId = 1;

const L = (n: number) =>
  leadIdSchema.parse(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);

function makeLead(overrides: Partial<StoredLead> = {}): StoredLead {
  return {
    id: L(5),
    number: Number((overrides.id ?? L(5)).slice(-12)),
    brand: 'Approved.rs',
    name: 'Иван',
    contact: '@ivan',
    service: 'vehicle-sourcing',
    services: ['vehicle-sourcing'],
    notes: [],
    locale: 'ru',
    status: 'new',
    telegramCard: { chatId: CARD_CHAT_ID, messageId: CARD_MESSAGE_ID },
    statusChangedAt: '2026-01-01T00:00:00.000Z',
    lastActivityAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
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
    remindAt: null,
    postponedFrom: null,
    ...overrides,
  };
}

async function seed(...leads: StoredLead[]): Promise<void> {
  await crmDatabase().lead.deleteMany();
  for (const lead of leads) await seedLead(lead);
}

const PAID_AT = '2026-01-03T00:00:00.000Z';

function awaiting(kind: NonNullable<StoredLead['pendingPrompt']>['kind']) {
  return { chatId: DM_CHAT_ID, messageId: PROMPT_ID, kind };
}

function makeCtx(
  body: unknown,
  headers: Record<string, string> = {
    'x-telegram-bot-api-secret-token': SECRET,
  },
) {
  return {
    request: new Request('http://localhost/api/telegram-webhook', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  } as Pick<APIContext, 'request'> as APIContext;
}

function tap(
  data: string,
  from: number,
  {
    id = 'cb',
    messageId = 1,
    chatId = DM_CHAT_ID,
    updateId = nextUpdateId++,
    shown = {},
  }: {
    id?: string;
    messageId?: number;
    chatId?: number;
    updateId?: number;
    shown?: { text?: string; reply_markup?: unknown };
  } = {},
) {
  return POST(
    makeCtx({
      update_id: updateId,
      callback_query: {
        id,
        data,
        from: { id: from },
        message: { message_id: messageId, chat: { id: chatId }, ...shown },
      },
    }),
  );
}

function message(
  text: string,
  from: number,
  {
    chatId = from,
    type = 'private',
    replyTo,
  }: {
    chatId?: number;
    type?: string;
    replyTo?: number;
  } = {},
) {
  return POST(
    makeCtx({
      update_id: nextUpdateId++,
      message: {
        message_id: 2,
        text,
        chat: { id: chatId, type },
        from: { id: from },
        ...(replyTo == null
          ? {}
          : { reply_to_message: { message_id: replyTo } }),
      },
    }),
  );
}

const answerPrompt = (text: string) =>
  message(text, OWNER_ID, { chatId: DM_CHAT_ID, replyTo: PROMPT_ID });

const crm = (method: string) =>
  api.callsTo(method, CRM_TOKEN).map((c) => c.payload);

const answers = () => crm('answerCallbackQuery');

const sentTo = (chatId: number | string) =>
  crm('sendMessage').filter((p) => p.chat_id === chatId);

const textsTo = (chatId: number | string) => sentTo(chatId).map((p) => p.text);

const forceReplies = () =>
  crm('sendMessage').filter(
    (p) => (p.reply_markup as { force_reply?: boolean })?.force_reply,
  );

const edits = (chatId: number, messageId: number) =>
  crm('editMessageText').filter(
    (p) => p.chat_id === chatId && p.message_id === messageId,
  );

const view = ({
  text,
  reply_markup,
}: {
  text: string;
  reply_markup: unknown;
}) => expect.objectContaining({ text, reply_markup });

async function stored(n = 5): Promise<StoredLead> {
  const lead = await getLead(L(n));
  expect(lead).toBeDefined();
  return lead!;
}

describe('POST /api/telegram-webhook', () => {
  beforeEach(async () => {
    api.reset();
    api.respond(
      'sendMessage',
      (payload: Record<string, unknown>): BotApiResponse => ({
        ok: true,
        result: {
          message_id: PROMPT_ID,
          date: 0,
          chat: { id: Number(payload.chat_id), type: 'private' },
        },
      }),
    );
    await seed(makeLead());
  });

  it('fails loudly when TELEGRAM_WEBHOOK_SECRET is unset rather than refusing every update', async () => {
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', '');

    await expect(POST(makeCtx({}))).rejects.toThrow(
      'TELEGRAM_WEBHOOK_SECRET is not set',
    );
    vi.unstubAllEnvs();
  });

  it('rejects a request without the secret token header', async () => {
    const res = await POST(makeCtx({}, {}));
    expect(res.status).toBe(401);
    expect(api.calls).toEqual([]);
  });

  it('rejects a request with the wrong secret token', async () => {
    const res = await POST(
      makeCtx({}, { 'x-telegram-bot-api-secret-token': 'wrong' }),
    );
    expect(res.status).toBe(401);
  });

  it('acks with 200 on a malformed JSON body instead of throwing, so Telegram stops retrying', async () => {
    const res = await POST(makeCtx('not json'));
    expect(res.status).toBe(200);
    expect(api.calls).toEqual([]);
  });

  it('acks a body past the size cap without handling it, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await POST(
      makeCtx({ update_id: 1, padding: 'a'.repeat(70_000) }),
    );
    expect(res.status).toBe(200);
    expect(api.calls).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      '[telegram-webhook] ignoring an update past the size cap',
    );
    warn.mockRestore();
  });

  it.each([
    ['wrong field types', { update_id: 'x', message: 5 }],
    ['a non-object', JSON.stringify('just a string')],
    [
      'a callback without an id',
      { callback_query: { data: `st:${L(5)}:won` } },
    ],
    [
      'an update without an update_id',
      {
        callback_query: {
          id: 'cb-noid',
          data: `st:${L(5)}:lost`,
          from: { id: OWNER_ID },
          message: { message_id: 1, chat: { id: DM_CHAT_ID } },
        },
      },
    ],
  ])(
    'acks with 200 on a well-formed JSON body of the wrong shape (%s) without running a handler',
    async (_label, body) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const before = await readLeads();
      const res = await POST(makeCtx(body));
      expect(res.status).toBe(200);
      expect(warn).toHaveBeenCalledOnce();
      expect(api.calls).toEqual([]);
      expect(await readLeads()).toEqual(before);
      warn.mockRestore();
    },
  );

  describe('duplicate delivery — same update_id is only processed once', () => {
    it('skips a redelivered update_id instead of writing twice', async () => {
      const first = await tap(`st:${L(5)}:lost`, OWNER_ID, {
        updateId: 918273645,
      });
      const writes = await readLeads();
      const calls = api.calls.length;
      const second = await tap(`st:${L(5)}:lost`, OWNER_ID, {
        updateId: 918273645,
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(await readLeads()).toEqual(writes);
      expect(api.calls).toHaveLength(calls);
      expect(answers()).toEqual([
        { callback_query_id: 'cb', text: 'Статус обновлён' },
      ]);
    });
  });

  describe('trust boundary — callbacks are gated on from.id, not chat', () => {
    it('rejects a status callback from someone who is neither owner nor admin', async () => {
      const res = await tap(`st:${L(5)}:lost`, OTHER_ID, { id: 'cb-x' });
      expect(res.status).toBe(200);
      expect((await stored()).status).toBe('new');
      expect(answers()).toEqual([{ callback_query_id: 'cb-x' }]);
    });
  });

  describe('status callbacks (st:<id>:<key>)', () => {
    it.each([
      ['won', '✅ Успешно'],
      ['lost', '❌ Отказ'],
    ])(
      'the admin sets %s from the DM detail and only the owner is told',
      async (key, mark) => {
        await tap(`st:${L(5)}:${key}`, ADMIN_ID, {
          id: 'cb-admin',
          chatId: ADMIN_ID,
          messageId: 560,
        });
        const lead = await stored();
        expect(lead.status).toBe(key);
        expect(edits(ADMIN_ID, 560)).toEqual([
          view(buildLeadDetail(lead, 'admin')),
        ]);
        expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
        expect(textsTo(OWNER_ID)).toEqual([
          `🔔 Заявка #5 Иван: статус — ${mark}\n✍️ Админ`,
        ]);
        expect(textsTo(ADMIN_ID)).toEqual([]);
        expect(answers()).toEqual([
          { callback_query_id: 'cb-admin', text: 'Статус обновлён' },
        ]);
      },
    );

    it('offers the admin the status and postpone buttons in the DM detail', () => {
      const data = buildLeadDetail(makeLead(), 'admin')
        .reply_markup.inline_keyboard.flat()
        .map((b) => b.callback_data);
      expect(data).toEqual(
        expect.arrayContaining([
          `st:${L(5)}:won`,
          `st:${L(5)}:lost`,
          `st:${L(5)}:negotiations`,
          `st:${L(5)}:in_progress`,
          `postpone:${L(5)}`,
          `del:${L(5)}`,
        ]),
      );
    });

    it('the admin cannot reopen a closed Lead either', async () => {
      await seed(makeLead({ status: 'won' }));
      await tap(`st:${L(5)}:in_progress`, ADMIN_ID, { id: 'cb-closed' });
      expect((await stored()).status).toBe('won');
      expect(answers()).toEqual([
        { callback_query_id: 'cb-closed', text: LEAD_ACTION_COPY.closed },
      ]);
      expect(crm('sendMessage')).toEqual([]);
    });

    it('sets status directly for in_progress/lost and refreshes both surfaces', async () => {
      const res = await tap(`st:${L(5)}:lost`, OWNER_ID, {
        id: 'cb-1',
        messageId: 555,
      });
      expect(res.status).toBe(200);
      const lead = await stored();
      expect(lead.status).toBe('lost');
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(edits(DM_CHAT_ID, 555)).toEqual([
        expect.objectContaining({
          text: buildLeadDetail(lead, 'owner').text,
        }),
      ]);
      expect(textsTo(ADMIN_ID)).toEqual([
        `🔔 Заявка #5 Иван: статус — ❌ Отказ\n✍️ Владелец`,
      ]);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-1', text: 'Статус обновлён' },
      ]);
    });

    it.each([
      ['negotiations', '🗣 Переговоры'],
      ['in_progress', '🔵 В работе'],
    ])(
      'moves the Lead into %s from the DM detail and redraws it',
      async (key, mark) => {
        await tap(`st:${L(5)}:${key}`, OWNER_ID, {
          id: 'cb-move',
          messageId: 557,
        });
        const lead = await stored();
        expect(lead.status).toBe(key);
        expect(edits(DM_CHAT_ID, 557)).toEqual([
          expect.objectContaining({
            text: expect.stringContaining(`Статус: ${mark}`),
          }),
        ]);
        expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
        expect(crm('unpinChatMessage')).toEqual([]);
      },
    );

    it('marks won at once, refreshes both surfaces, unpins the card and asks for no amount', async () => {
      await tap(`st:${L(5)}:won`, OWNER_ID, { id: 'cb-2', messageId: 556 });
      const lead = await stored();
      expect(lead).toMatchObject({ status: 'won', pendingPrompt: null });
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(edits(DM_CHAT_ID, 556)).toHaveLength(1);
      expect(crm('unpinChatMessage')).toEqual([
        { chat_id: CARD_CHAT_ID, message_id: CARD_MESSAGE_ID },
      ]);
      expect(forceReplies()).toEqual([]);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-2', text: 'Статус обновлён' },
      ]);
    });

    it('leaves a won lead alone on a second ✅ tap', async () => {
      await seed(makeLead({ status: 'won', statusChangedAt: PAID_AT }));
      const writes = await readLeads();
      await tap(`st:${L(5)}:won`, OWNER_ID);
      expect(await readLeads()).toEqual(writes);
      expect(crm('editMessageText')).toEqual([]);
      expect(crm('unpinChatMessage')).toEqual([]);
      expect(forceReplies()).toEqual([]);
    });

    it('does nothing when the lead is not found', async () => {
      const writes = await readLeads();
      await tap(`st:${L(99)}:in_progress`, OWNER_ID, { id: 'cb-3' });
      expect(await readLeads()).toEqual(writes);
      expect(answers()).toEqual([{ callback_query_id: 'cb-3' }]);
    });

    it('acks without updating for an unrecognized status key', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await tap(`st:${L(5)}:bogus`, OWNER_ID, { id: 'cb-4' });
      expect((await stored()).status).toBe('new');
      expect(answers()).toEqual([{ callback_query_id: 'cb-4' }]);
      warn.mockRestore();
    });

    it('acks with an error message and does not throw if the store write fails', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(setStatus).mockRejectedValueOnce(new Error('down'));
      const res = await tap(`st:${L(5)}:lost`, OWNER_ID, { id: 'cb-5' });
      expect(res.status).toBe(200);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-5', text: 'Ошибка, попробуйте ещё раз' },
      ]);
      error.mockRestore();
    });
  });

  describe('outcome buttons on the group card', () => {
    const onCard = { chatId: CARD_CHAT_ID, messageId: CARD_MESSAGE_ID };

    it('✅ marks won, keeps the card a teaser, unpins it and asks nothing', async () => {
      await tap(`won:${L(5)}`, OWNER_ID, { id: 'cb-won', ...onCard });

      expect(await stored()).toMatchObject({
        status: 'won',
        pendingPrompt: null,
      });
      const [card] = edits(CARD_CHAT_ID, CARD_MESSAGE_ID);
      expect(card?.reply_markup).toMatchObject({
        inline_keyboard: expect.arrayContaining([
          [
            { text: '✅ Сделка', callback_data: `won:${L(5)}` },
            { text: '❌ Отказ', callback_data: `lost:${L(5)}` },
          ],
        ]),
      });
      expect(JSON.stringify(card?.reply_markup)).not.toMatch(
        new RegExp(`talk:${L(5)}|work:${L(5)}|postpone:${L(5)}`),
      );
      expect(crm('unpinChatMessage')).toEqual([
        { chat_id: CARD_CHAT_ID, message_id: CARD_MESSAGE_ID },
      ]);
      expect(forceReplies()).toEqual([]);
      expect(await readOperations()).toEqual([]);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-won', text: 'Статус обновлён' },
      ]);
    });

    it('❌ marks lost, unpins the card and asks nothing', async () => {
      await tap(`lost:${L(5)}`, OWNER_ID, { id: 'cb-lost', ...onCard });

      expect((await stored()).status).toBe('lost');
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(crm('unpinChatMessage')).toEqual([
        { chat_id: CARD_CHAT_ID, message_id: CARD_MESSAGE_ID },
      ]);
      expect(forceReplies()).toEqual([]);
      expect(sentTo(ADMIN_ID)).toHaveLength(1);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-lost', text: 'Статус обновлён' },
      ]);
    });

    it('❌ on a lead already lost writes nothing and unpins nothing', async () => {
      await seed(makeLead({ status: 'lost' }));
      const writes = await readLeads();
      await tap(`lost:${L(5)}`, OWNER_ID, onCard);
      expect(await readLeads()).toEqual(writes);
      expect(crm('unpinChatMessage')).toEqual([]);
    });

    it('🔵 moves the Lead into in_progress, keeps it pinned and the card a teaser', async () => {
      await tap(`work:${L(5)}`, OWNER_ID, { id: 'cb-work', ...onCard });

      expect(await stored()).toMatchObject({ status: 'in_progress' });
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toEqual([
        expect.objectContaining({
          text: expect.stringContaining('🔵 В работе'),
        }),
      ]);
      expect(crm('unpinChatMessage')).toEqual([]);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-work', text: 'Статус обновлён' },
      ]);
    });

    it('🔵 on a Lead already in progress records a touch and changes nothing else', async () => {
      await seed(makeLead({ status: 'in_progress' }));
      await tap(`work:${L(5)}`, OWNER_ID, { id: 'cb-work', ...onCard });

      const lead = await stored();
      expect(lead).toMatchObject({
        status: 'in_progress',
        statusChangedAt: '2026-01-01T00:00:00.000Z',
      });
      expect(lead.lastActivityAt).toEqual(expect.any(String));
      expect(crm('editMessageText')).toEqual([]);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-work', text: 'В работе 🔵' },
      ]);
    });

    it('⏰ opens the remind picker on the card and a quick pick restores the teaser', async () => {
      await tap(`postpone:${L(5)}`, OWNER_ID, { id: 'cb-pp', ...onCard });
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toEqual([
        expect.objectContaining({ text: '⏰ Когда напомнить?' }),
      ]);

      await tap(`remindpick:${L(5)}:3`, OWNER_ID, { id: 'cb-pick', ...onCard });

      expect(await stored()).toMatchObject({
        status: 'postponed',
        postponedFrom: 'new',
      });
      const teaser = edits(CARD_CHAT_ID, CARD_MESSAGE_ID).at(-1);
      expect(teaser?.text).toContain('⏸️ Отложена');
      expect(teaser?.text).toContain('⏰ Напомнить: ');
      expect(teaser?.text).not.toContain('Контакт:');
    });

    it('◀️ Назад on the card puts the teaser back', async () => {
      await tap(`postpone:${L(5)}`, OWNER_ID, onCard);
      await tap(`remindcancel:${L(5)}`, OWNER_ID, onCard);

      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID).at(-1)?.text).toContain(
        '🆕 Новая',
      );
      expect((await stored()).status).toBe('new');
    });

    it('⏰ on a Lead that cannot be postponed says so and keeps the card', async () => {
      await seed(makeLead({ status: 'won' }));
      await tap(`postpone:${L(5)}`, OWNER_ID, { id: 'cb-pp', ...onCard });

      expect(crm('editMessageText')).toEqual([]);
      expect(answers()).toEqual([
        {
          callback_query_id: 'cb-pp',
          text: '⚠️ Заявку уже нельзя отложить: она больше не открыта.',
        },
      ]);
    });

    it('🗣 moves the Lead into negotiations, keeps it pinned and listed', async () => {
      await tap(`talk:${L(5)}`, OWNER_ID, { id: 'cb-talk', ...onCard });

      expect(await stored()).toMatchObject({
        status: 'negotiations',
      });
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(crm('unpinChatMessage')).toEqual([]);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-talk', text: 'Статус обновлён' },
      ]);

      await tap('menu:open', OWNER_ID);
      expect(JSON.stringify(sentTo(DM_CHAT_ID))).toContain(`open:${L(5)}`);
    });

    it.each([
      [`talk:${L(5)}`, 'won'],
      [`work:${L(5)}`, 'lost'],
      [`st:${L(5)}:negotiations`, 'won'],
      [`st:${L(5)}:in_progress`, 'lost'],
    ] as const)(
      '%s from a stale button never reopens a %s Lead',
      async (data, status) => {
        await seed(makeLead({ status, statusChangedAt: PAID_AT }));
        await tap(data, OWNER_ID, { id: 'cb-stale', ...onCard });

        expect(await stored()).toMatchObject({
          status,
          statusChangedAt: PAID_AT,
        });
        expect(crm('editMessageText')).toEqual([]);
        expect(answers()).toEqual([
          { callback_query_id: 'cb-stale', text: LEAD_ACTION_COPY.closed },
        ]);
      },
    );

    it('🗣 on a postponed Lead moves it and drops the reminder', async () => {
      await seed(
        makeLead({
          status: 'postponed',
          postponedFrom: 'in_progress',
          remindAt: '2026-10-20',
        }),
      );
      await tap(`talk:${L(5)}`, OWNER_ID, onCard);

      expect(await stored()).toMatchObject({
        status: 'negotiations',
        postponedFrom: null,
        remindAt: null,
      });
    });

    it('re-posts a won lead whose card is gone without pinning it', async () => {
      api.fail('editMessageText', 'Bad Request: message to edit not found');
      await tap(`won:${L(5)}`, OWNER_ID, onCard);
      expect(crm('pinChatMessage')).toEqual([]);
      expect(sentTo(GROUP_ID)).toHaveLength(1);
    });

    it.each([
      [`won:${L(5)}`, 'won', '✅ Успешно'],
      [`lost:${L(5)}`, 'lost', '❌ Отказ'],
      [`talk:${L(5)}`, 'negotiations', '🗣 Переговоры'],
      [`work:${L(5)}`, 'in_progress', '🔵 В работе'],
    ])(
      '%s works for the admin too and tells the owner',
      async (data, status, mark) => {
        await tap(data, ADMIN_ID, { id: 'cb-admin', ...onCard });
        expect((await stored()).status).toBe(status);
        expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
        expect(textsTo(OWNER_ID)).toEqual([
          `🔔 Заявка #5 Иван: статус — ${mark}\n✍️ Админ`,
        ]);
        expect(textsTo(ADMIN_ID)).toEqual([]);
        expect(answers()).toEqual([
          { callback_query_id: 'cb-admin', text: 'Статус обновлён' },
        ]);
      },
    );

    it.each([`won:${L(99)}`, `lost:${L(99)}`])(
      '%s for an unknown lead is a bare ack',
      async (data) => {
        await tap(data, OWNER_ID, { id: 'cb-none', ...onCard });
        expect(answers()).toEqual([{ callback_query_id: 'cb-none' }]);
        expect(forceReplies()).toEqual([]);
      },
    );
  });

  describe('the posted daily digest', () => {
    const DIGEST_ID = 700;
    const seedWithDigest = async (
      due: number[],
      stale: number[],
      ...leads: StoredLead[]
    ) => {
      await seed(...leads);
      const digest = await crmDatabase().digest.create({
        data: {
          day: new Date('2026-01-01'),
          createdAt: new Date('2026-01-01T08:00:00.000Z'),
          messageId: DIGEST_ID,
          hidden: 0,
        },
      });
      const entries = (list: 'due' | 'stale', ids: number[]) =>
        ids.map((n, position) => ({
          digestId: digest.id,
          leadId: L(n),
          list,
          position,
        }));
      await crmDatabase().digestLead.createMany({
        data: [...entries('due', due), ...entries('stale', stale)],
      });
    };
    const digestEdits = () =>
      crm('editMessageText').filter(
        (p) => p.chat_id === GROUP_ID && p.message_id === DIGEST_ID,
      );
    const link = (n: number) =>
      `<a href="https://t.me/approved_test_bot?start=lead_${L(n)}">#${n}</a> Иван · Approved.rs`;

    it('drops a Lead the admin closes from its card, and Leads closed meanwhile', async () => {
      await seedWithDigest(
        [4, 5],
        [6, 7],
        makeLead({ id: L(4), status: 'won' }),
        makeLead({ id: L(5) }),
        makeLead({
          id: L(6),
          telegramCard: { chatId: CARD_CHAT_ID, messageId: 556 },
          status: 'negotiations',
        }),
        makeLead({
          id: L(7),
          telegramCard: { chatId: CARD_CHAT_ID, messageId: 557 },
        }),
      );

      await tap(`st:${L(6)}:lost`, ADMIN_ID, { id: 'cb-dg' });

      expect((await stored(6)).status).toBe('lost');
      expect(edits(CARD_CHAT_ID, 556)).toHaveLength(1);
      expect(digestEdits()).toEqual([
        expect.objectContaining({
          text: [
            '<b>📋 Заявки ждут решения</b>',
            '',
            '<b>⏰ Пора вернуться</b>',
            link(5),
            '',
            '<b>🕐 Без движения 7 дней</b>',
            link(7),
          ].join('\n'),
        }),
      ]);
      expect(digestEdits()[0]!.reply_markup).toBeUndefined();
      expect(textsTo(OWNER_ID)).toEqual([
        `🔔 Заявка #6 Иван: статус — ❌ Отказ\n✍️ Админ`,
      ]);
    });

    it('🔵 on a Lead already in progress records the touch and drops it', async () => {
      await seedWithDigest(
        [],
        [5, 6],
        makeLead({ status: 'in_progress' }),
        makeLead({ id: L(6) }),
      );

      await tap(`work:${L(5)}`, ADMIN_ID, { id: 'cb-touch' });

      expect((await stored()).lastActivityAt).not.toBeNull();
      expect(digestEdits()).toEqual([
        expect.objectContaining({
          text: expect.not.stringContaining(`#5<`),
        }),
      ]);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-touch', text: LEAD_ACTION_COPY.inWork },
      ]);
    });

    it('says everything is sorted once the last Lead is decided', async () => {
      await seedWithDigest([], [5], makeLead({ id: L(5) }));

      await tap(`won:${L(5)}`, ADMIN_ID);

      expect(digestEdits()).toEqual([
        expect.objectContaining({
          text: '<b>📋 Заявки ждут решения</b>\n\n✅ Всё разобрано',
        }),
      ]);
    });

    it('drops a Lead the admin deletes', async () => {
      await seedWithDigest(
        [],
        [5, 6],
        makeLead({ id: L(5) }),
        makeLead({ id: L(6) }),
      );

      await tap(`delconfirm:${L(5)}`, ADMIN_ID);

      expect(digestEdits()).toEqual([
        expect.objectContaining({
          text: expect.not.stringContaining(`#5<`),
        }),
      ]);
    });

    it('leaves the digest alone for a Lead it does not list', async () => {
      await seedWithDigest(
        [],
        [6],
        makeLead({ id: L(5) }),
        makeLead({ id: L(6) }),
      );

      await tap(`won:${L(5)}`, ADMIN_ID);

      expect(digestEdits()).toEqual([]);
    });
  });

  describe('topic: — 💬 Начать переписку on a Lead the bot knows', () => {
    const onCard = { chatId: CARD_CHAT_ID, messageId: CARD_MESSAGE_ID };
    const START = {
      text: '💬 Начать переписку',
      callback_data: `topic:${L(5)}`,
    };
    const buttons = (payload: Record<string, unknown> | undefined) =>
      (
        payload?.reply_markup as { inline_keyboard: Record<string, string>[][] }
      ).inline_keyboard.flat();

    beforeEach(async () => await seed(makeLead({ telegramId: 777 })));

    it('offers the button only to a Lead with a telegramId and no topic', async () => {
      await tap(`open:${L(5)}`, OWNER_ID);
      await seed(makeLead({ telegramId: 777, topicId: 9 }));
      await tap(`open:${L(5)}`, OWNER_ID);
      await seed(makeLead());
      await tap(`open:${L(5)}`, OWNER_ID);
      const [bare, topical, plain] = sentTo(DM_CHAT_ID).map(buttons);
      expect(bare).toContainEqual(START);
      expect(topical).not.toContainEqual(START);
      expect(topical).toContainEqual({
        text: '💬 Открыть тему',
        url: 'https://t.me/c/9876543210/9',
      });
      expect(plain).not.toContainEqual(START);
    });

    it('opens one topic with the summary, stores it and links the card', async () => {
      await tap(`topic:${L(5)}`, ADMIN_ID, { id: 'cb-topic', ...onCard });

      expect(crm('createForumTopic')).toEqual([
        { chat_id: GROUP_ID, name: `#5 · Иван · Approved.rs` },
      ]);
      const lead = await stored();
      expect(lead.topicId).toEqual(expect.any(Number));
      expect(lead.topicMessageId).toBe(PROMPT_ID);
      expect(sentTo(GROUP_ID)).toEqual([
        expect.objectContaining({
          message_thread_id: lead.topicId,
          text: expect.stringContaining(`Заявка #5`),
        }),
      ]);
      const [card] = edits(CARD_CHAT_ID, CARD_MESSAGE_ID);
      expect(buttons(card)).toContainEqual({
        text: '💬 Открыть тему',
        url: `https://t.me/c/9876543210/${lead.topicId}`,
      });
      expect(buttons(card)).not.toContainEqual(START);
      expect(crm('editMessageText')).toHaveLength(1);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-topic', text: LEAD_ACTION_COPY.topicOpened },
      ]);
    });

    it('redraws the detail it was tapped on as well as the group card', async () => {
      await tap(`topic:${L(5)}`, OWNER_ID, { messageId: 42 });
      const lead = await stored();
      expect(edits(DM_CHAT_ID, 42)).toEqual([
        view(buildLeadDetail(lead, 'owner')),
      ]);
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
    });

    it('opens no second topic on a second tap', async () => {
      await tap(`topic:${L(5)}`, OWNER_ID, onCard);
      const { topicId } = await stored();
      await tap(`topic:${L(5)}`, OWNER_ID, { id: 'cb-again', ...onCard });

      expect(crm('createForumTopic')).toHaveLength(1);
      expect((await stored()).topicId).toBe(topicId);
      expect(answers()).toContainEqual({
        callback_query_id: 'cb-again',
        text: LEAD_ACTION_COPY.topicOpened,
      });
    });

    it('answers with the reason when the group cannot open topics', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.fail('createForumTopic', 'Bad Request: the chat is not a forum');

      await tap(`topic:${L(5)}`, OWNER_ID, { id: 'cb-fail', ...onCard });

      expect((await stored()).topicId).toBeNull();
      expect(crm('editMessageText')).toEqual([]);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-fail', text: LEAD_ACTION_COPY.topicFailed },
      ]);
      expect(error).toHaveBeenCalledWith(
        '[telegram-webhook] could not open the topic',
        expect.objectContaining({ leadId: L(5) }),
      );
      error.mockRestore();
    });

    it('is a bare ack for an unknown Lead', async () => {
      await tap(`topic:${L(99)}`, OWNER_ID, { id: 'cb-none' });
      expect(crm('createForumTopic')).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-none' }]);
    });
  });

  describe('Bot API errors the edits swallow', () => {
    it('treats "message is not modified" as a successful edit', async () => {
      api.fail(
        'editMessageText',
        'Bad Request: message is not modified: specified new message content and reply markup are exactly the same',
      );
      await tap(`st:${L(5)}:lost`, OWNER_ID, { id: 'cb-nm' });
      expect((await stored()).status).toBe('lost');
      expect(crm('editMessageText')).toHaveLength(2);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-nm', text: 'Статус обновлён' },
      ]);
    });

    it('posts a fresh group card when the old one is gone ("message to edit not found")', async () => {
      api.fail('editMessageText', 'Bad Request: message to edit not found');
      await seed(makeLead({ pendingPrompt: awaiting('postpone') }));

      await answerPrompt(LATER);

      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(sentTo(GROUP_ID)).toHaveLength(1);
      expect(crm('pinChatMessage')).toEqual([]);
      expect(await stored()).toMatchObject({
        status: 'postponed',
        telegramCard: { chatId: Number(GROUP_ID), messageId: PROMPT_ID },
      });
    });

    it('still fails the tap on any other edit error', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.fail('editMessageText', 'Bad Request: chat not found');
      await tap(`st:${L(5)}:lost`, OWNER_ID, { id: 'cb-err' });
      expect(answers()).toEqual([
        { callback_query_id: 'cb-err', text: 'Ошибка, попробуйте ещё раз' },
      ]);
      error.mockRestore();
    });
  });

  describe('postpone: — either role, opens the picker in place of the card', () => {
    it('replaces the card with the quick-pick/calendar/type menu', async () => {
      await tap(`postpone:${L(5)}`, OWNER_ID, { id: 'cb-pp1' });
      const picker = buildRemindPicker(L(5));
      expect(edits(DM_CHAT_ID, 1)).toEqual([view(picker)]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-pp1' }]);
    });

    it('the admin can postpone too', async () => {
      await tap(`postpone:${L(5)}`, ADMIN_ID);
      expect(edits(DM_CHAT_ID, 1)).toEqual([view(buildRemindPicker(L(5)))]);
    });

    it('acks without opening the picker when the lead is not found', async () => {
      await seed();
      await tap(`postpone:${L(5)}`, OWNER_ID, { id: 'cb-pp3' });
      expect(crm('editMessageText')).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-pp3' }]);
    });
  });

  describe('remindpick: — quick preset, applies immediately', () => {
    it('postpones with a date N days out and refreshes both surfaces', async () => {
      await tap(`remindpick:${L(5)}:7`, OWNER_ID, { id: 'cb-rp1' });
      const lead = await stored();
      expect(lead).toMatchObject({
        status: 'postponed',
        remindAt: businessDay(new Date(), 7),
        notes: [
          expect.objectContaining({
            author: 'owner',
            text: expect.stringContaining('Отложено до'),
          }),
        ],
      });
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(edits(DM_CHAT_ID, 1)).toHaveLength(1);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-rp1', text: 'Отложено' },
      ]);
    });

    it('counts the days from the Belgrade date between 00:00 and 02:00 there', async () => {
      vi.useFakeTimers({
        toFake: ['Date'],
        now: new Date('2026-10-15T23:30:00Z'),
      });
      try {
        await tap(`remindpick:${L(5)}:1`, OWNER_ID);
      } finally {
        vi.useRealTimers();
      }
      expect((await stored()).remindAt).toBe('2026-10-17');
    });

    it('the admin can use a quick pick, and the owner is told', async () => {
      await tap(`remindpick:${L(5)}:7`, ADMIN_ID, { chatId: ADMIN_ID });
      expect((await stored()).status).toBe('postponed');
      expect(textsTo(OWNER_ID)).toEqual([
        expect.stringContaining('⏸️ Отложена\n✍️ Админ'),
      ]);
      expect(textsTo(ADMIN_ID)).toEqual([]);
    });

    it('acks without refreshing anything when the lead cannot be postponed', async () => {
      await seed(makeLead({ status: 'lost' }));
      await tap(`remindpick:${L(5)}:7`, OWNER_ID, { id: 'cb-rp3' });
      expect((await stored()).status).toBe('lost');
      expect(crm('editMessageText')).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-rp3' }]);
    });
  });

  describe('remindtype: — falls back to the typed-date prompt', () => {
    it('sends the date prompt and remembers it as a "postpone" pending prompt', async () => {
      await tap(`remindtype:${L(5)}`, OWNER_ID, { id: 'cb-rt1' });
      expect(forceReplies()).toEqual([
        expect.objectContaining({
          chat_id: DM_CHAT_ID,
          text: expect.stringContaining('ДД.ММ.ГГГГ'),
        }),
      ]);
      expect((await stored()).pendingPrompt).toEqual(awaiting('postpone'));
      expect(answers()).toEqual([
        { callback_query_id: 'cb-rt1', text: 'Жду дату' },
      ]);
    });

    it('acks without prompting when the lead is not found', async () => {
      await seed();
      await tap(`remindtype:${L(5)}`, OWNER_ID, { id: 'cb-rt2' });
      expect(forceReplies()).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-rt2' }]);
    });
  });

  describe('remindcancel: — back out to the normal lead card', () => {
    it('restores the detail view without postponing', async () => {
      await tap(`remindcancel:${L(5)}`, OWNER_ID);
      const lead = await stored();
      expect(lead.status).toBe('new');
      expect(edits(DM_CHAT_ID, 1)).toEqual([
        view(buildLeadDetail(lead, 'owner')),
      ]);
    });
  });

  describe('resume: — either role, reopens a postponed lead', () => {
    const postponed = () =>
      makeLead({ status: 'postponed', remindAt: '2099-10-20' });

    it('owner can resume', async () => {
      await seed(postponed());
      await tap(`resume:${L(5)}`, OWNER_ID, { id: 'cb-rs1' });
      expect(await stored()).toMatchObject({
        status: 'new',
        remindAt: null,
      });
      expect(edits(DM_CHAT_ID, 1)).toHaveLength(1);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-rs1', text: 'Возобновлено' },
      ]);
    });

    it('admin can resume too', async () => {
      await seed(postponed());
      await tap(`resume:${L(5)}`, ADMIN_ID);
      expect((await stored()).status).toBe('new');
    });
  });

  describe('del: / delconfirm: / delcancel: — admin only, permanent delete', () => {
    it('del:<id> shows a confirm prompt in place, does not delete yet', async () => {
      await tap(`del:${L(5)}`, ADMIN_ID);
      const lead = await stored();
      expect(edits(DM_CHAT_ID, 1)).toEqual([view(buildDeleteConfirm(lead))]);
    });

    it('owner cannot even open the confirm prompt', async () => {
      await tap(`del:${L(5)}`, OWNER_ID);
      expect(crm('editMessageText')).toEqual([]);
    });

    it('delconfirm:<id> actually deletes and clears the message', async () => {
      await tap(`delconfirm:${L(5)}`, ADMIN_ID, { id: 'cb-del3' });
      expect(await getLead(L(5))).toBeUndefined();
      expect(edits(DM_CHAT_ID, 1)).toEqual([
        expect.objectContaining({
          text: '🗑 Заявка удалена.',
          reply_markup: { inline_keyboard: [] },
        }),
      ]);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-del3', text: 'Удалено' },
      ]);
    });

    it('owner cannot confirm a delete', async () => {
      await tap(`delconfirm:${L(5)}`, OWNER_ID);
      expect(await getLead(L(5))).toBeDefined();
    });

    it('delcancel:<id> restores the normal detail view without deleting', async () => {
      await tap(`delcancel:${L(5)}`, ADMIN_ID);
      const lead = await stored();
      expect(edits(DM_CHAT_ID, 1)).toEqual([
        view(buildLeadDetail(lead, 'admin')),
      ]);
    });
  });

  describe('menu:open / open: / menu:stats', () => {
    it('menu:open lists open and postponed Leads, never lost ones', async () => {
      await seed(
        makeLead({ id: L(5) }),
        makeLead({
          id: L(6),
          status: 'postponed',
          createdAt: '2026-01-02T00:00:00.000Z',
        }),
        makeLead({ id: L(7), status: 'lost' }),
        makeLead({ id: L(8), status: 'won' }),
      );
      await tap('menu:open', OWNER_ID);
      expect(sentTo(DM_CHAT_ID)).toEqual([
        view(buildOpenList(await readLeads())),
      ]);
      expect(
        buildOpenList(await readLeads()).reply_markup.inline_keyboard.map(
          ([b]) => b!.callback_data,
        ),
      ).toEqual([`open:${L(6)}`, `open:${L(5)}`]);
    });

    it("open:<id> sends the detail view for the tapper's role", async () => {
      await tap(`open:${L(5)}`, ADMIN_ID);
      expect(sentTo(DM_CHAT_ID)).toEqual([
        view(buildLeadDetail(await stored(), 'admin')),
      ]);
    });

    it('open:<id> for a missing lead just acks', async () => {
      await tap(`open:${L(404)}`, OWNER_ID, { id: 'cb-19' });
      expect(crm('sendMessage')).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-19' }]);
    });

    it('menu:stats sends Lead counts and the ledger to the admin', async () => {
      vi.useFakeTimers({
        toFake: ['Date'],
        now: new Date('2026-10-15T12:00:00Z'),
      });
      vi.setSystemTime(new Date('2026-09-20T10:00:00.000Z'));
      await ledgerStore.recordOperation({
        type: 'payout',
        amount: 300,
        note: 'за BMW',
        by: 'owner',
      });
      vi.setSystemTime(new Date('2026-10-02T10:00:00.000Z'));
      await ledgerStore.recordOperation({
        type: 'settlement',
        amount: 100,
        by: 'admin',
      });
      vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
      try {
        await tap('menu:stats', ADMIN_ID, { chatId: ADMIN_ID });
      } finally {
        vi.useRealTimers();
      }
      const [text] = textsTo(ADMIN_ID);
      expect(text).toContain('🆕 Новая: 1');
      expect(text).toContain('<b>💶 Мне должны: 200 €</b>');
      expect(text).toContain('За месяц: +0 € · −100 €');
      expect(text).toContain('За всё время: +300 € · −100 €');
      expect(text).toContain(
        '• 02.10.2026 · −100 € · Админ\n• 20.09.2026 · +300 € · Владелец · за BMW',
      );
    });

    it('tells the owner menu:stats is the admin’s', async () => {
      await tap('menu:stats', OWNER_ID, { id: 'cb-st', chatId: OWNER_ID });
      expect(crm('sendMessage')).toEqual([]);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-st', text: 'Это действие доступно админу' },
      ]);
    });
  });

  describe('menu:debt — the Balance, both roles', () => {
    it.each([
      [ADMIN_ID, 'admin'],
      [OWNER_ID, 'owner'],
    ] as const)('shows %i the %s Balance with ➕/➖', async (who, role) => {
      await ledgerStore.recordOperation({
        type: 'payout',
        amount: 80,
        by: 'owner',
      });
      await ledgerStore.recordOperation({
        type: 'settlement',
        amount: 30,
        by: 'admin',
      });
      await tap('menu:debt', who, { chatId: who });
      expect(sentTo(who)).toEqual([view(buildBalance(role, 50))]);
    });
  });

  describe('Balance operations — ➕ Зачислить / ➖ Списать in the private chat', () => {
    const answerAs = (who: number, text: string) =>
      message(text, who, { replyTo: PROMPT_ID });

    async function ask(who: number, type: 'payout' | 'settlement') {
      await tap(`ledger:${type}`, who, { id: 'cb-ledger', chatId: who });
      api.calls.length = 0;
    }

    it.each([OWNER_ID, ADMIN_ID])(
      'asks %i for the amount by a force reply',
      async (who) => {
        const writes = await readLeads();
        await tap('ledger:payout', who, { id: 'cb-ledger', chatId: who });
        expect(forceReplies()).toEqual([
          expect.objectContaining({
            chat_id: who,
            text: LEDGER_COPY.prompt.payout,
          }),
        ]);
        expect(answers()).toEqual([
          { callback_query_id: 'cb-ledger', text: LEDGER_COPY.ack },
        ]);
        expect(await readLeads()).toEqual(writes);
      },
    );

    it('stores the owner credit at once, confirms with the Balance and tells the admin', async () => {
      await ask(OWNER_ID, 'payout');
      await answerAs(OWNER_ID, '40 Иван сервис');
      const [operation] = await readOperations();
      expect(operation).toMatchObject({
        type: 'payout',
        amount: 40,
        note: 'Иван сервис',
        createdBy: 'owner',
      });
      expect(sentTo(OWNER_ID)).toEqual([
        expect.objectContaining({
          text: operationRecordedText(operation!, 40),
          reply_parameters: {
            message_id: 2,
            allow_sending_without_reply: true,
          },
        }),
      ]);
      expect(textsTo(ADMIN_ID)).toEqual([
        `💶 Владелец: +${formatMoney(40)} · Иван сервис · баланс ${formatMoney(40)}`,
      ]);
    });

    it('takes a debit from the admin and tells the owner', async () => {
      await ledgerStore.recordOperation({
        type: 'payout',
        amount: 80,
        by: 'owner',
      });
      await ask(ADMIN_ID, 'settlement');
      await answerAs(ADMIN_ID, '30');
      expect(await readBalance()).toBe(50);
      expect(textsTo(ADMIN_ID)).toEqual([
        `✅ −${formatMoney(30)} · баланс ${formatMoney(50)}`,
      ]);
      expect(textsTo(OWNER_ID)).toEqual([
        `💶 Админ: −${formatMoney(30)} · баланс ${formatMoney(50)}`,
      ]);
    });

    it('lets the owner debit and the admin credit too', async () => {
      await ask(ADMIN_ID, 'payout');
      await answerAs(ADMIN_ID, '15 забыл');
      await ask(OWNER_ID, 'settlement');
      await answerAs(OWNER_ID, '15');
      expect(
        (await readOperations()).map((o) => [o.type, o.createdBy]),
      ).toEqual([
        ['payout', 'admin'],
        ['settlement', 'owner'],
      ]);
      expect(await readBalance()).toBe(0);
    });

    it('refuses a debit above the Balance by asking again, naming the Balance, and stores nothing', async () => {
      await ledgerStore.recordOperation({
        type: 'payout',
        amount: 10,
        by: 'owner',
      });
      await ask(OWNER_ID, 'settlement');
      api.respond(
        'sendMessage',
        (payload: Record<string, unknown>): BotApiResponse => ({
          ok: true,
          result: {
            message_id: PROMPT_ID + 1,
            date: 0,
            chat: { id: Number(payload.chat_id), type: 'private' },
          },
        }),
      );
      await answerAs(OWNER_ID, '30');
      expect(forceReplies()).toEqual([
        expect.objectContaining({
          chat_id: OWNER_ID,
          text: operationRefusedText('settlement', 10),
        }),
      ]);
      expect(textsTo(ADMIN_ID)).toEqual([]);
      expect(await readOperations()).toHaveLength(1);

      await answerAs(OWNER_ID, '5');
      expect(await readBalance()).toBe(10);
      await message('5', OWNER_ID, { replyTo: PROMPT_ID + 1 });
      expect(await readBalance()).toBe(5);
    });

    it('tells the user to tap again when the prompt has expired', async () => {
      await ask(OWNER_ID, 'payout');
      vi.useFakeTimers({
        toFake: ['Date'],
        now: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      try {
        await answerAs(OWNER_ID, '40');
      } finally {
        vi.useRealTimers();
      }
      expect(textsTo(OWNER_ID)).toEqual([LEDGER_COPY.expired]);
      expect(await readOperations()).toEqual([]);
    });

    it('keeps answering an expired prompt as expired, never asking again', async () => {
      await ask(OWNER_ID, 'payout');
      vi.useFakeTimers({
        toFake: ['Date'],
        now: Date.now() + 8 * 24 * 60 * 60 * 1000,
      });
      try {
        await answerAs(OWNER_ID, 'Иван сервис');
        expect(forceReplies()).toEqual([]);
        expect(textsTo(OWNER_ID)).toEqual([LEDGER_COPY.expired]);
        api.respond(
          'sendMessage',
          (payload: Record<string, unknown>): BotApiResponse => ({
            ok: true,
            result: {
              message_id: PROMPT_ID + 1,
              date: 0,
              chat: { id: Number(payload.chat_id), type: 'private' },
            },
          }),
        );
        await ask(OWNER_ID, 'payout');
        await answerAs(OWNER_ID, '40');
      } finally {
        vi.useRealTimers();
      }
      expect(forceReplies()).toEqual([]);
      expect(textsTo(OWNER_ID)).toEqual([LEDGER_COPY.expired]);
      expect(await readOperations()).toEqual([]);
    });

    it('asks again when the reply has no amount', async () => {
      await ask(OWNER_ID, 'settlement');
      await answerAs(OWNER_ID, 'Иван сервис');
      expect(forceReplies()).toEqual([
        expect.objectContaining({
          chat_id: OWNER_ID,
          text: reAskOperationText('settlement', 'no_number'),
        }),
      ]);
      expect(await readOperations()).toEqual([]);
    });

    it.each(['12.345', '0', '1000001'])(
      'asks again naming the limits when %j is not an amount it can take',
      async (text) => {
        await ask(OWNER_ID, 'payout');
        await answerAs(OWNER_ID, text);
        expect(forceReplies()).toEqual([
          expect.objectContaining({
            chat_id: OWNER_ID,
            text: reAskOperationText('payout', 'bad_amount'),
          }),
        ]);
        expect(await readOperations()).toEqual([]);
      },
    );

    it('retires the prompt it asks again for, so only the new one takes an answer', async () => {
      await ask(OWNER_ID, 'payout');
      api.respond(
        'sendMessage',
        (payload: Record<string, unknown>): BotApiResponse => ({
          ok: true,
          result: {
            message_id: PROMPT_ID + 1,
            date: 0,
            chat: { id: Number(payload.chat_id), type: 'private' },
          },
        }),
      );
      await answerAs(OWNER_ID, 'сорок');
      await answerAs(OWNER_ID, '40');
      expect(await readOperations()).toEqual([]);

      await message('40', OWNER_ID, { replyTo: PROMPT_ID + 1 });
      expect(await readBalance()).toBe(40);
    });

    it('records one operation per prompt', async () => {
      await ask(OWNER_ID, 'payout');
      await answerAs(OWNER_ID, '40');
      await answerAs(OWNER_ID, '40');
      expect(await readBalance()).toBe(40);
      expect(textsTo(ADMIN_ID)).toHaveLength(1);
    });

    it('ignores a stranger answering the prompt', async () => {
      await ask(OWNER_ID, 'payout');
      await message('40', OTHER_ID, { chatId: OWNER_ID, replyTo: PROMPT_ID });
      expect(await readOperations()).toEqual([]);
      expect(textsTo(OWNER_ID)).toEqual([LEAD_ACTION_COPY.denied]);
    });

    it('shows the new Balance in the menu', async () => {
      await ask(OWNER_ID, 'payout');
      await answerAs(OWNER_ID, '40,5 €');
      api.calls.length = 0;
      await message('/menu', OWNER_ID);
      expect(sentTo(OWNER_ID)).toEqual([view(buildMenu('owner', 40.5))]);
    });
  });

  it('acks an unrecognized callback without touching any lead', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await tap('unknown:thing', OWNER_ID, { id: 'cb-23', chatId: 1 });
    expect(api.calls.map((c) => c.method)).toEqual(['answerCallbackQuery']);
    expect(answers()).toEqual([{ callback_query_id: 'cb-23' }]);
    warn.mockRestore();
  });

  it.each(['open:123', 'st:5:won', 'del:5'])(
    'acks a button with an old numeric lead id (%s) and touches nothing',
    async (data) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const before = await readLeads();
      await tap(data, OWNER_ID, { id: 'cb-old', chatId: 1 });
      expect(api.calls.map((c) => c.method)).toEqual(['answerCallbackQuery']);
      expect(await readLeads()).toEqual(before);
      warn.mockRestore();
    },
  );

  it('logs a tap Telegram refuses to acknowledge', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.fail('answerCallbackQuery', 'query is too old');

    await POST(
      makeCtx({
        update_id: 2_400_000_025,
        callback_query: {
          id: 'cb-25',
          data: `st:${L(5)}:won`,
          from: { id: OWNER_ID },
        },
      }),
    );

    expect(error).toHaveBeenCalledWith(
      '[telegram-webhook] could not answer the tap',
      expect.anything(),
    );
  });

  it('acks without acting when a callback has no message attached', async () => {
    await POST(
      makeCtx({
        update_id: 2_400_000_024,
        callback_query: {
          id: 'cb-24',
          data: `st:${L(5)}:won`,
          from: { id: OWNER_ID },
        },
      }),
    );
    expect(api.calls.map((c) => c.method)).toEqual(['answerCallbackQuery']);
    expect(answers()).toEqual([{ callback_query_id: 'cb-24' }]);
  });

  describe('malformed callback_data — none of these should reach a handler', () => {
    it.each([
      'st:abc:won',
      `arch:${L(5)}`,
      `unarch:${L(5)}`,
      `edit:${L(5)}:service`,
      `edit:${L(5)}:comment`,
      'note:x',
      `st:${L(5)}:open`,
      `st:${L(5)}:postponed`,
      'list:new',
      'menu:deals',
      '',
      `pay:${L(5)}`,
      'payfix:1',
      'settle:other',
      'settle:12.5',
    ])('%j falls through to unrecognized', async (data) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const before = await stored();
      await tap(data, data === `pay:${L(5)}` ? ADMIN_ID : OWNER_ID, {
        id: 'cb-bad',
      });
      expect(api.calls.map((c) => c.method)).toEqual(['answerCallbackQuery']);
      expect(answers()).toEqual([{ callback_query_id: 'cb-bad' }]);
      expect(await stored()).toEqual(before);
      expect(warn).toHaveBeenCalledWith(
        '[telegram-webhook] unknown callback data',
        { data },
      );
      warn.mockRestore();
    });
  });

  describe('callback table', () => {
    const ROWS: [string, 'owner' | 'admin' | 'any'][] = [
      [`st:${L(5)}:won`, 'any'],
      [`st:${L(5)}:lost`, 'any'],
      [`st:${L(5)}:negotiations`, 'any'],
      [`st:${L(5)}:in_progress`, 'any'],
      [`won:${L(5)}`, 'any'],
      [`lost:${L(5)}`, 'any'],
      [`talk:${L(5)}`, 'any'],
      [`work:${L(5)}`, 'any'],
      [`postpone:${L(5)}`, 'any'],
      [`remindpick:${L(5)}:3`, 'any'],
      [`remindtype:${L(5)}`, 'any'],
      [`remindcancel:${L(5)}`, 'any'],
      [`resume:${L(5)}`, 'any'],
      [`del:${L(5)}`, 'admin'],
      [`delconfirm:${L(5)}`, 'admin'],
      [`delcancel:${L(5)}`, 'admin'],
      ['menu:open', 'any'],
      [`open:${L(5)}`, 'any'],
      [`topic:${L(5)}`, 'any'],
      [`edit:${L(5)}:name`, 'any'],
      [`edit:${L(5)}:contact`, 'any'],
      [`note:${L(5)}`, 'any'],
      ['menu:stats', 'admin'],
      ['menu:debt', 'any'],
      ['ledger:payout', 'any'],
      ['ledger:settlement', 'any'],
    ];

    it('has one row per sample, each matched first by its own row and role', () => {
      expect(CALLBACKS).toHaveLength(ROWS.length);
      ROWS.forEach(([data, role], i) => {
        expect(CALLBACKS.findIndex(([pattern]) => pattern.test(data))).toBe(i);
        expect(CALLBACKS[i]![1]).toBe(role);
      });
    });

    it.each(ROWS.filter(([, role]) => role !== 'any'))(
      '%s refuses the other role with a toast',
      async (data, role) => {
        const before = await readLeads();
        const writes = await readLeads();
        await tap(data, role === 'owner' ? ADMIN_ID : OWNER_ID, {
          id: 'cb-table',
        });
        expect(api.calls.map((c) => c.method)).toEqual(['answerCallbackQuery']);
        expect(answers()).toEqual([
          {
            callback_query_id: 'cb-table',
            text: LEAD_ACTION_COPY.roleOnly[role as 'owner' | 'admin'],
          },
        ]);
        expect(await readLeads()).toEqual(writes);
        expect(await readLeads()).toEqual(before);
      },
    );

    it('passes the captured groups to the handler', async () => {
      await seed(makeLead(), makeLead({ id: L(6) }));
      await tap(`remindpick:${L(6)}:3`, OWNER_ID);
      expect(await stored(6)).toMatchObject({
        status: 'postponed',
        remindAt: businessDay(new Date(), 3),
      });
      expect((await stored(5)).status).toBe('new');
    });
  });

  describe('/start in a private chat', () => {
    it.each([
      [OWNER_ID, 'owner'],
      [ADMIN_ID, 'admin'],
    ] as const)('shows %i the %s menu', async (who, role) => {
      await message('/start', who);
      expect(sentTo(who)).toEqual([view(buildMenu(role, 0))]);
    });

    it('denies /start from anyone else', async () => {
      await message('/start', OTHER_ID);
      expect(textsTo(OTHER_ID)).toEqual(['⛔ Доступ запрещён.']);
    });

    it('/start lead_<id> opens the lead detail directly for an authorized sender', async () => {
      await message(`/start lead_${L(5)}`, OWNER_ID);
      expect(sentTo(OWNER_ID)).toEqual([
        view(buildLeadDetail(await stored(), 'owner')),
      ]);
    });

    it("/start lead_<id> lists the VIN searches of a CarLab Lead's visitor", async () => {
      await seed(makeLead({ brand: 'CarLab', visitorId: VISITOR }));
      await message(`/start lead_${L(5)}`, OWNER_ID);
      expect(textsTo(OWNER_ID)[0]).toContain(
        '🔎 Искал: BMW 116d E81, VIN …1234',
      );
    });

    it('/start lead_<id> never asks the shop about an Approved.rs Lead', async () => {
      await seed(makeLead({ visitorId: VISITOR }));
      await message(`/start lead_${L(5)}`, OWNER_ID);
      expect(textsTo(OWNER_ID)[0]).not.toContain('🔎 Искал');
    });

    it('/start lead_<id> for an unknown lead falls back to the menu', async () => {
      await message(`/start lead_${L(404)}`, OWNER_ID);
      expect(sentTo(OWNER_ID)).toEqual([view(buildMenu('owner', 0))]);
    });

    it('/start lead_<id> denies an unauthorized sender even with a valid payload', async () => {
      await message(`/start lead_${L(5)}`, OTHER_ID);
      expect(textsTo(OTHER_ID)).toEqual(['⛔ Доступ запрещён.']);
    });
  });

  describe('/menu — same as bare /start, never takes a payload', () => {
    it.each([
      [OWNER_ID, 'owner'],
      [ADMIN_ID, 'admin'],
    ] as const)('shows %i the %s menu', async (who, role) => {
      await message('/menu', who);
      expect(sentTo(who)).toEqual([view(buildMenu(role, 0))]);
    });

    it('denies an unauthorized sender', async () => {
      await message('/menu', OTHER_ID);
      expect(textsTo(OTHER_ID)).toEqual(['⛔ Доступ запрещён.']);
    });
  });

  describe('/help', () => {
    it('shows role-specific help text', async () => {
      await message('/help', OWNER_ID);
      expect(textsTo(OWNER_ID)).toEqual([buildHelp('owner')]);
    });

    it('denies an unauthorized sender', async () => {
      await message('/help', OTHER_ID);
      expect(textsTo(OTHER_ID)).toEqual(['⛔ Доступ запрещён.']);
    });
  });

  describe('replying to a pending force_reply prompt', () => {
    it('ignores an answer to an amount prompt left from before ✅ stopped asking', async () => {
      await seed({
        ...makeLead({ status: 'won' }),
        pendingPrompt: {
          ...awaiting('postpone'),
          kind: 'deal_amount',
        } as unknown as StoredLead['pendingPrompt'],
      });

      await answerPrompt('150');

      expect(sentTo(DM_CHAT_ID)).toEqual([view(buildSearchResults([]))]);
      expect(await readOperations()).toEqual([]);
      expect((await stored()).pendingPrompt).toBeNull();
    });

    it('postpones with the given date, adds a staff note, and notifies the admin', async () => {
      await seed(
        makeLead({ comment: 'BMW X5', pendingPrompt: awaiting('postpone') }),
      );
      await answerPrompt(LATER);
      expect(await stored()).toMatchObject({
        status: 'postponed',
        remindAt: '2099-10-20',
        comment: 'BMW X5',
        notes: [
          expect.objectContaining({
            author: 'owner',
            text: `Отложено до ${LATER}`,
          }),
        ],
      });
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(sentTo(ADMIN_ID)).toHaveLength(1);
    });

    it('does not postpone via typed reply if the lead moved on while the prompt sat unanswered (stale guard)', async () => {
      await seed(
        makeLead({ status: 'won', pendingPrompt: awaiting('postpone') }),
      );
      await answerPrompt(LATER);
      expect((await stored()).status).toBe('won');
      expect(crm('editMessageText')).toEqual([]);
      expect(sentTo(ADMIN_ID)).toEqual([]);
      expect(textsTo(DM_CHAT_ID)).toEqual([LEAD_ACTION_COPY.notPostponable]);
    });

    it.each([
      ['a malformed date', 'завтра'],
      ['a past date', '01.01.2020'],
      ['an impossible calendar date', '31.02.2099'],
    ])('rejects %s without resolving the prompt', async (_label, text) => {
      await seed(makeLead({ pendingPrompt: awaiting('postpone') }));
      await answerPrompt(text);
      expect(await stored()).toMatchObject({
        status: 'new',
        pendingPrompt: awaiting('postpone'),
      });
      expect(textsTo(DM_CHAT_ID)).toEqual([
        expect.stringContaining('ДД.ММ.ГГГГ'),
      ]);
    });

    it.each([
      ['15.10.2026', 'new'],
      ['16.10.2026', 'postponed'],
    ])(
      'judges %s against the Belgrade date between 00:00 and 02:00 there',
      async (text, status) => {
        await seed(makeLead({ pendingPrompt: awaiting('postpone') }));
        vi.useFakeTimers({
          toFake: ['Date'],
          now: new Date('2026-10-15T22:30:00Z'),
        });
        try {
          await answerPrompt(text);
        } finally {
          vi.useRealTimers();
        }
        expect((await stored()).status).toBe(status);
      },
    );

    it('searches with a DM reply that matches no prompt or card', async () => {
      await message('Иван', OWNER_ID, { replyTo: 42 });
      const results = await searchLeads('Иван');
      expect(results).toHaveLength(1);
      expect(sentTo(OWNER_ID)).toEqual([view(buildSearchResults(results))]);
    });

    it('denies a DM reply from an unknown user like any other message', async () => {
      await message('hi', OTHER_ID, { replyTo: 42 });
      expect(textsTo(OTHER_ID)).toEqual([LEAD_ACTION_COPY.denied]);
    });

    it('reply correlation is attempted regardless of chat type (not gated behind private-only) — defense in depth', async () => {
      await seed(
        makeLead({
          pendingPrompt: { chatId: -100999, messageId: 42, kind: 'postpone' },
        }),
      );
      await message(LATER, OWNER_ID, {
        chatId: -100999,
        type: 'group',
        replyTo: 42,
      });
      expect((await stored()).status).toBe('postponed');
    });
  });

  describe('editing a Lead from the bot DM', () => {
    const editKeys = [`edit:${L(5)}:name`, `edit:${L(5)}:contact`];
    const callbackData = (markup: unknown) =>
      (
        markup as { inline_keyboard: { callback_data?: string }[][] }
      ).inline_keyboard
        .flat()
        .map((b) => b.callback_data);
    const notices = (chatId: number) =>
      textsTo(chatId).filter((t) => String(t).startsWith('✏️ Заявка'));
    const edit = async (
      field: 'name' | 'contact',
      text: string,
      who = OWNER_ID,
    ) => {
      await tap(`edit:${L(5)}:${field}`, who, { chatId: who });
      await message(text, who, { replyTo: PROMPT_ID });
    };

    it.each([
      [OWNER_ID, 'owner'],
      [ADMIN_ID, 'admin'],
    ] as const)(
      'offers ✏️ and 📝 to %i (%s) on the detail',
      async (who, role) => {
        await tap(`open:${L(5)}`, who, { chatId: who });
        const [detail] = sentTo(who);
        expect(detail).toEqual(view(buildLeadDetail(await stored(), role)));
        expect(callbackData(detail!.reply_markup)).toEqual(
          expect.arrayContaining([...editKeys, `note:${L(5)}`]),
        );
      },
    );

    it('asks for the value with a force-reply prompt kept on the Lead', async () => {
      await tap(`edit:${L(5)}:contact`, ADMIN_ID, { chatId: ADMIN_ID });
      expect(forceReplies()).toEqual([
        expect.objectContaining({
          chat_id: ADMIN_ID,
          text: EDIT_COPY.prompt('contact'),
        }),
      ]);
      expect(answers()).toEqual([
        expect.objectContaining({ text: EDIT_COPY.ack }),
      ]);
      expect((await stored()).pendingPrompt).toEqual({
        chatId: ADMIN_ID,
        messageId: PROMPT_ID,
        kind: 'edit_contact',
      });
    });

    const noContact = (contact: string) =>
      makeLead({
        name: '',
        contact,
        kind: 'call_click',
        contactChannel: null,
        service: '',
        services: [],
      });

    it.each([
      ['name', 'Пётр', { name: 'Пётр' }, 'Иван', '@ivan'],
      [
        'contact',
        '064 123 4567',
        { contact: '+381641234567', contactChannel: 'phone' },
        '—',
        '—',
      ],
    ] as const)(
      'stores the new %s, refreshes the card and tells the admin, not the owner',
      async (field, text, patch, before, contact) => {
        await seed(makeLead({ contact }));
        await edit(field, text);
        const lead = await stored();
        expect(lead).toMatchObject({ ...patch, pendingPrompt: null });
        expect(lead.lastActivityAt).not.toBeNull();
        const [card] = edits(CARD_CHAT_ID, CARD_MESSAGE_ID);
        expect(card).toBeDefined();
        expect(callbackData(card!.reply_markup)).not.toEqual(
          expect.arrayContaining([`edit:${L(5)}:name`]),
        );
        expect(callbackData(card!.reply_markup)).not.toContain(`note:${L(5)}`);
        expect(sentTo(OWNER_ID).at(-1)).toEqual(
          expect.objectContaining({
            text: `${EDIT_COPY.updated}\n\n${buildLeadDetail(lead, 'owner').text}`,
          }),
        );
        expect(notices(OWNER_ID)).toEqual([]);
        expect(notices(ADMIN_ID)).toEqual([
          expect.stringContaining(`Было: ${before}`),
        ]);
        expect(notices(ADMIN_ID)[0]).toContain('✍️ Владелец');
      },
    );

    it('tells the owner, not the admin, when the admin edits', async () => {
      await edit('name', 'Пётр', ADMIN_ID);
      expect((await stored()).name).toBe('Пётр');
      expect(notices(ADMIN_ID)).toEqual([]);
      expect(notices(OWNER_ID)).toEqual([expect.stringContaining('✍️ Админ')]);
      expect(notices(OWNER_ID)[0]).toContain('Стало: Пётр');
    });

    it('refreshes the Topic summary as well', async () => {
      await seed(makeLead({ telegramId: 42, topicId: 77, topicMessageId: 78 }));
      await edit('name', 'Пётр');
      expect(
        crm('editMessageText').filter(
          (p) => p.chat_id === GROUP_ID && p.message_id === 78,
        ),
      ).toEqual([
        expect.objectContaining({
          text: expect.stringContaining('Имя: Пётр'),
        }),
      ]);
    });

    it('renames the Topic after a new name', async () => {
      await seed(makeLead({ telegramId: 42, topicId: 77, topicMessageId: 78 }));
      await edit('name', 'Пётр');
      expect(crm('editForumTopic')).toEqual([
        {
          chat_id: GROUP_ID,
          message_thread_id: 77,
          name: `#5 · Пётр · Approved.rs`,
        },
      ]);
    });

    it('renames nothing for a Lead without a Topic or on a contact edit', async () => {
      await edit('name', 'Пётр');
      await seed(makeLead({ telegramId: 42, topicId: 77, topicMessageId: 78 }));
      await edit('contact', '@petr');
      expect(crm('editForumTopic')).toEqual([]);
    });

    it('still stores the name when Telegram will not rename the Topic', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      await seed(makeLead({ telegramId: 42, topicId: 77, topicMessageId: 78 }));
      api.fail('editForumTopic', 'Bad Request: not enough rights');
      await edit('name', 'Пётр');
      expect((await stored()).name).toBe('Пётр');
      expect(error).toHaveBeenCalledWith(
        '[telegram] editForumTopic failed',
        expect.objectContaining({ topicId: 77 }),
      );
      expect(notices(ADMIN_ID)).toHaveLength(1);
      error.mockRestore();
    });

    it('sends no notice when the value did not change', async () => {
      await edit('name', 'Иван');
      expect(notices(ADMIN_ID)).toEqual([]);
    });

    it('offers no way to edit the visitor comment', async () => {
      await seed(makeLead({ comment: 'от посетителя' }));
      await tap(`open:${L(5)}`, OWNER_ID);
      const [detail] = sentTo(OWNER_ID);
      expect(callbackData(detail!.reply_markup)).not.toContain(
        `edit:${L(5)}:comment`,
      );
    });

    it.each([
      ['@petr', { contact: '@petr', contactChannel: 'telegram' }],
      ['https://t.me/petr', { contact: '@petr', contactChannel: 'telegram' }],
      ['petr@mail.rs', { contact: 'petr@mail.rs', contactChannel: null }],
      [
        'https://instagram.com/petr',
        { contact: 'https://instagram.com/petr', contactChannel: null },
      ],
    ])('takes %s as a contact', async (text, patch) => {
      await seed(noContact('—'));
      await edit('contact', text);
      expect(await stored()).toMatchObject(patch);
    });

    it('turns a placeholder click into a real contact, keeping its channel', async () => {
      await seed(
        makeLead({
          name: '',
          contact: '—',
          kind: 'call_click',
          contactChannel: 'whatsapp',
          service: '',
          services: [],
        }),
      );
      await edit('contact', '+381 64 123 4567');
      expect(await stored()).toMatchObject({
        contact: '+381641234567',
        contactChannel: 'whatsapp',
        kind: 'call_click',
      });
      expect(notices(ADMIN_ID)).toEqual([
        expect.stringContaining('Было: —\nСтало: +381641234567'),
      ]);
    });

    it.each([
      ['contact', 'не знаю'],
      ['contact', '+381 1'],
      ['name', '   '],
    ] as const)(
      'asks again for %s on %j and changes nothing',
      async (field, text) => {
        await edit(field, text);
        expect(await stored()).toMatchObject({
          name: 'Иван',
          contact: '@ivan',
          pendingPrompt: {
            chatId: OWNER_ID,
            messageId: PROMPT_ID,
            kind: `edit_${field}`,
          },
        });
        expect(forceReplies().at(-1)).toEqual(
          expect.objectContaining({ text: reAskEditText(field) }),
        );
        expect(crm('editMessageText')).toEqual([]);
        expect(notices(ADMIN_ID)).toEqual([]);
      },
    );

    it('replaces a bare Telegram id with a real contact', async () => {
      await seed(noContact('tg://user?id=42'));
      await edit('contact', '@petr');
      expect(await stored()).toMatchObject({
        contact: '@petr',
        contactChannel: 'telegram',
      });
      expect(notices(ADMIN_ID)).toEqual([
        expect.stringContaining('Стало: @petr'),
      ]);
    });

    it.each([
      ['@ivan', '+381 64 123 4567', '+381641234567'],
      ['+381641234567', '@petr', '@petr'],
    ])(
      'keeps the real contact %s and notes %s beside it',
      async (contact, text, added) => {
        await seed(makeLead({ contact, comment: 'BMW X5' }));
        await edit('contact', text);
        const lead = await stored();
        expect(lead).toMatchObject({
          contact,
          comment: 'BMW X5',
          notes: [
            expect.objectContaining({
              author: 'owner',
              text: extraContactNote(added),
            }),
          ],
          pendingPrompt: null,
        });
        expect(sentTo(OWNER_ID).at(-1)).toEqual(
          expect.objectContaining({
            text: `${EDIT_COPY.contactNoted}\n\n${buildLeadDetail(lead, 'owner').text}`,
          }),
        );
        expect(notices(ADMIN_ID)).toEqual([]);
        expect(textsTo(ADMIN_ID)).toEqual([
          `📝 Заявка #5 Иван · Владелец: Доп. контакт: ${added}`,
        ]);
        expect(textsTo(OWNER_ID)).not.toContainEqual(
          expect.stringContaining('📝 Заявка'),
        );
      },
    );

    it('stores the answer to the prompt it asked again with', async () => {
      await seed(noContact('—'));
      await edit('contact', 'не знаю');
      await message('@petr', OWNER_ID, { replyTo: PROMPT_ID });
      expect((await stored()).contact).toBe('@petr');
    });

    it('adds a 📝 note with its author and date, keeping the comment', async () => {
      await seed(makeLead({ comment: 'BMW X5' }));
      await tap(`note:${L(5)}`, ADMIN_ID, { chatId: ADMIN_ID });
      expect(forceReplies()).toEqual([
        expect.objectContaining({ text: EDIT_COPY.notePrompt }),
      ]);
      expect((await stored()).pendingPrompt?.kind).toBe('note');
      await message('Перезвонить в пятницу', ADMIN_ID, { replyTo: PROMPT_ID });
      const lead = await stored();
      expect(lead).toMatchObject({
        comment: 'BMW X5',
        notes: [
          expect.objectContaining({
            author: 'admin',
            text: 'Перезвонить в пятницу',
          }),
        ],
        pendingPrompt: null,
      });
      expect(lead.lastActivityAt).not.toBeNull();
      expect(sentTo(ADMIN_ID).at(-1)).toEqual(
        expect.objectContaining({
          text: `${LEAD_ACTION_COPY.noteAdded}\n\n${buildLeadDetail(lead, 'admin').text}`,
        }),
      );
      expect(notices(OWNER_ID)).toEqual([]);
      expect(textsTo(OWNER_ID)).toEqual([
        `📝 Заявка #5 Иван · Админ: Перезвонить в пятницу`,
      ]);
      expect(textsTo(ADMIN_ID)).not.toContainEqual(
        expect.stringContaining('📝 Заявка'),
      );
    });

    it('asks again for the note on an empty answer', async () => {
      await tap(`note:${L(5)}`, OWNER_ID);
      await message('  ', OWNER_ID, { replyTo: PROMPT_ID });
      expect(await stored()).toMatchObject({
        pendingPrompt: { chatId: OWNER_ID, kind: 'note' },
      });
      expect((await stored()).notes).toEqual([]);
      expect(forceReplies().at(-1)).toEqual(
        expect.objectContaining({ text: reAskEditText('note') }),
      );
      expect(textsTo(ADMIN_ID)).toEqual([]);
    });

    it.each([`edit:${L(404)}:name`, `note:${L(404)}`])(
      '%s on a missing Lead just acks',
      async (data) => {
        await tap(data, OWNER_ID, { id: 'cb-missing' });
        expect(api.calls.map((c) => c.method)).toEqual(['answerCallbackQuery']);
      },
    );
  });

  describe("a message in a Lead's topic", () => {
    const TOPIC_ID = 77;

    const topicLead = (overrides: Partial<StoredLead> = {}) =>
      makeLead({
        contact: 'tg://user?id=4242',
        telegramId: 4242,
        topicId: TOPIC_ID,
        topicMessageId: 78,
        ...overrides,
      });

    function topicMessage(
      from: number,
      {
        topicId = TOPIC_ID,
        chatId = Number(GROUP_ID),
        isBot = false,
        content = { text: 'Нашёл вариант' },
      }: {
        topicId?: number;
        chatId?: number;
        isBot?: boolean;
        content?: Record<string, unknown>;
      } = {},
    ) {
      return POST(
        makeCtx({
          update_id: nextUpdateId++,
          message: {
            message_id: 2,
            ...content,
            message_thread_id: topicId,
            is_topic_message: true,
            chat: { id: chatId, type: 'supergroup', is_forum: true },
            from: { id: from, is_bot: isBot, first_name: 'X' },
            reply_to_message: {
              message_id: topicId,
              chat: { id: chatId, type: 'supergroup' },
            },
          },
        }),
      );
    }

    const copies = (token: string) =>
      api.callsTo('copyMessage', token).map((c) => c.payload);

    const copiedToVisitor = {
      chat_id: 4242,
      from_chat_id: Number(GROUP_ID),
      message_id: 2,
    };

    it('copies the owner message to the visitor and opens negotiations', async () => {
      await seed(topicLead());

      await topicMessage(OWNER_ID);

      expect(copies(APPROVED_CAPTURE_TOKEN)).toEqual([copiedToVisitor]);
      expect(copies(CARLAB_CAPTURE_TOKEN)).toEqual([]);
      expect(await stored()).toMatchObject({
        status: 'negotiations',
        lastActivityAt: expect.any(String),
      });
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(sentTo(ADMIN_ID)).toHaveLength(1);
      expect(sentTo(Number(GROUP_ID))).toEqual([]);
    });

    it('reopens a closed topic before relaying the owner message', async () => {
      await seed(topicLead({ topicClosed: true }));

      await topicMessage(OWNER_ID);

      expect(
        api.calls
          .filter((c) => /ForumTopic|copyMessage/.test(c.method))
          .map((c) => c.method),
      ).toEqual(['reopenForumTopic', 'copyMessage']);
      expect(crm('reopenForumTopic')).toEqual([
        { chat_id: GROUP_ID, message_thread_id: TOPIC_ID },
      ]);
      expect(await stored()).toMatchObject({
        topicClosed: false,
        topicActiveAt: expect.any(String),
      });
    });

    it('stamps an open topic without reopening it', async () => {
      await seed(topicLead());

      await topicMessage(OWNER_ID);

      expect(crm('reopenForumTopic')).toEqual([]);
      expect((await stored()).topicActiveAt).toEqual(expect.any(String));
    });

    it.each(['won', 'lost'])('closes the topic on %s', async (key) => {
      await seed(topicLead());

      await tap(`st:${L(5)}:${key}`, OWNER_ID);

      expect(crm('closeForumTopic')).toEqual([
        { chat_id: GROUP_ID, message_thread_id: TOPIC_ID },
      ]);
      expect((await stored()).topicClosed).toBe(true);
      expect(
        crm('editMessageText').filter((p) => p.message_id === 78),
      ).toHaveLength(1);
    });

    it('keeps the topic marked open and still answers the tap when Telegram will not close it', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.fail('closeForumTopic', 'Bad Request: not enough rights');
      await seed(topicLead());

      await tap(`st:${L(5)}:won`, OWNER_ID);

      expect((await stored()).status).toBe('won');
      expect((await stored()).topicClosed).toBe(false);
      expect(crm('answerCallbackQuery')).toHaveLength(1);
      error.mockRestore();
    });

    it('leaves the topic open on negotiations', async () => {
      await seed(topicLead());

      await tap(`st:${L(5)}:negotiations`, OWNER_ID);

      expect((await stored()).status).toBe('negotiations');
      expect(crm('closeForumTopic')).toEqual([]);
    });

    it('copies media from an admin just like text', async () => {
      await seed(topicLead());

      await topicMessage(ADMIN_ID, {
        content: {
          photo: [{ file_id: 'p', file_unique_id: 'u', width: 1, height: 1 }],
        },
      });

      expect(copies(APPROVED_CAPTURE_TOKEN)).toEqual([copiedToVisitor]);
    });

    it.each(['@ivan', '+381601234567', 'tg://user?id=4242'])(
      'reaches a visitor whose contact is %s',
      async (contact) => {
        await seed(topicLead({ contact }));

        await topicMessage(OWNER_ID);

        expect(copies(APPROVED_CAPTURE_TOKEN)).toEqual([copiedToVisitor]);
      },
    );

    it.each(['negotiations', 'postponed'] as const)(
      'leaves a %s Lead where it is',
      async (status) => {
        await seed(topicLead({ status }));
        const before = await stored();

        await topicMessage(OWNER_ID);

        expect(copies(APPROVED_CAPTURE_TOKEN)).toEqual([copiedToVisitor]);
        expect(await stored()).toEqual({
          ...before,
          lastActivityAt: expect.any(String),
          topicActiveAt: expect.any(String),
        });
        expect(crm('editMessageText')).toEqual([]);
        expect(sentTo(ADMIN_ID)).toEqual([]);
      },
    );

    it("copies a sibling brand's topic through that brand's capture bot", async () => {
      await seed(topicLead({ brand: 'CarLab' }));

      await topicMessage(OWNER_ID);

      expect(copies(CARLAB_CAPTURE_TOKEN)).toEqual([copiedToVisitor]);
      expect(copies(APPROVED_CAPTURE_TOKEN)).toEqual([]);
    });

    it('reports an undelivered copy in the topic and keeps the Lead open', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.fail('copyMessage', 'Forbidden: bot was blocked by the user', 403);
      await seed(topicLead());

      await topicMessage(OWNER_ID);

      expect(copies(APPROVED_CAPTURE_TOKEN)).toHaveLength(1);
      expect(sentTo(Number(GROUP_ID))).toEqual([
        expect.objectContaining({
          text: REPLY_COPY.undelivered,
          message_thread_id: TOPIC_ID,
        }),
      ]);
      expect((await stored()).status).toBe('new');
      error.mockRestore();
    });

    it.each([
      ['the brand has no capture bot configured', { brand: 'Details' }],
      ['the lead carries no telegramId', { telegramId: null }],
    ])(
      'reports the copy as undelivered when %s',
      async (_label, overrides: Partial<StoredLead>) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await seed(topicLead(overrides));

        await topicMessage(OWNER_ID);

        expect(api.callsTo('copyMessage')).toEqual([]);
        expect(sentTo(Number(GROUP_ID))).toEqual([
          expect.objectContaining({ text: REPLY_COPY.undelivered }),
        ]);
        expect((await stored()).status).toBe('new');
        warn.mockRestore();
      },
    );

    it.each([
      ['a bot', () => topicMessage(OTHER_ID, { isBot: true })],
      [
        'a bot carrying an owner id',
        () => topicMessage(OWNER_ID, { isBot: true }),
      ],
      ['a group member without a role', () => topicMessage(OTHER_ID)],
      ['a topic no Lead owns', () => topicMessage(OWNER_ID, { topicId: 5 })],
      ['another chat', () => topicMessage(OWNER_ID, { chatId: -100777 })],
      [
        'a topic closed notice',
        () => topicMessage(OWNER_ID, { content: { forum_topic_closed: {} } }),
      ],
      [
        'a pin notice',
        () =>
          topicMessage(OWNER_ID, {
            content: {
              pinned_message: {
                message_id: 9,
                date: 0,
                chat: { id: Number(GROUP_ID), type: 'supergroup' },
              },
            },
          }),
      ],
    ])('relays nothing from %s', async (_label, send) => {
      await seed(topicLead());
      const before = await stored();

      await send();

      expect(api.callsTo('copyMessage')).toEqual([]);
      expect(crm('sendMessage')).toEqual([]);
      expect(await stored()).toEqual(before);
    });

    it('treats an answer to a left-over reply-through-bot prompt as a search', async () => {
      await seed({
        ...topicLead(),
        pendingPrompt: {
          ...awaiting('postpone'),
          kind: 'reply_visitor',
        } as unknown as StoredLead['pendingPrompt'],
      });

      await answerPrompt('Нашёл вариант');

      expect(api.callsTo('copyMessage')).toEqual([]);
      expect(sentTo(DM_CHAT_ID)).toEqual([view(buildSearchResults([]))]);
    });
  });

  describe('plain DM text (search)', () => {
    it('treats plain DM text from the owner as a search query', async () => {
      await message('Иван', OWNER_ID);
      const results = await searchLeads('Иван');
      expect(results).toHaveLength(1);
      expect(sentTo(OWNER_ID)).toEqual([view(buildSearchResults(results))]);
    });

    it('finds a lost Lead the open list leaves out', async () => {
      await seed(makeLead({ status: 'lost', name: 'Марко' }));
      await message('марко', OWNER_ID);
      const results = await searchLeads('марко');
      expect(results.map((l) => [l.id, l.status])).toEqual([[L(5), 'lost']]);
      expect(sentTo(OWNER_ID)).toEqual([view(buildSearchResults(results))]);
    });

    it('denies plain DM text from an unknown user', async () => {
      await message('hi', OTHER_ID);
      expect(textsTo(OTHER_ID)).toEqual(['⛔ Доступ запрещён.']);
    });
  });

  describe('replying to a Lead card in the group', () => {
    const cardReply = (text: string, from = OWNER_ID) =>
      message(text, from, {
        chatId: CARD_CHAT_ID,
        type: 'supergroup',
        replyTo: CARD_MESSAGE_ID,
      });

    it('is group discussion: stores no note, sends nothing, moves no money', async () => {
      await seed(makeLead({ comment: 'Звонил' }));
      for (const from of [OWNER_ID, ADMIN_ID]) {
        await cardReply('80', from);
        await cardReply('Иван 30, приедет в пятницу', from);
      }
      expect((await stored()).comment).toBe('Звонил');
      expect((await stored()).lastActivityAt).toBeNull();
      expect(await readOperations()).toEqual([]);
      expect(api.calls).toEqual([]);
    });

    it('ignores a reply from someone who is neither owner nor admin', async () => {
      await cardReply('80', OTHER_ID);
      expect(api.calls).toEqual([]);
      expect((await stored()).comment).toBeNull();
    });

    it('gives a pending prompt priority over the card', async () => {
      await seed(
        makeLead({
          pendingPrompt: {
            chatId: CARD_CHAT_ID,
            messageId: CARD_MESSAGE_ID,
            kind: 'postpone',
          },
        }),
      );
      await cardReply('80');
      expect((await stored()).comment).toBeNull();
      expect(textsTo(CARD_CHAT_ID)).toEqual([
        expect.stringContaining('ДД.ММ.ГГГГ'),
      ]);
    });
  });

  it('ignores group chatter that is not a button press or a prompt reply', async () => {
    await message('hi everyone', OWNER_ID, {
      chatId: CARD_CHAT_ID,
      type: 'group',
    });
    expect(api.calls).toEqual([]);
  });
});
