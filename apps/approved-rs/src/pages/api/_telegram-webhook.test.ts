import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { addDays, format } from 'date-fns';
import { LEADS_PATH, LEDGER_PATH } from '@podbor/lead-crm';
import {
  createMemoryStorage,
  recordBotApi,
  type BotApiResponse,
  type MemoryStorage,
} from '@podbor/lead-crm/testing';
import type { StoredLead } from '@/lib/store';

const memory = vi.hoisted(() => {
  process.env.TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB = 'test-carlab-capture-token';
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

import { POST, CALLBACKS } from './telegram-webhook';
import {
  buildDeleteConfirm,
  buildHelp,
  buildLeadDetail,
  buildOpenList,
  buildMenu,
  buildBalance,
  formatMoney,
  LEDGER_COPY,
  operationRecordedText,
  operationRefusedText,
  reAskOperationText,
  buildRemindPicker,
  buildSearchResults,
  buildStats,
} from '@/lib/telegram';
import {
  getLead,
  readLeads,
  searchLeads,
  readBalance,
  readOperations,
  recordOperation,
} from '@/lib/store';

const api = recordBotApi();
vi.stubGlobal('fetch', api.fetch);

const SECRET = 'test-webhook-secret';
const CRM_TOKEN = 'test-bot-token';
const APPROVED_CAPTURE_TOKEN = 'test-capture-bot-token';
const CARLAB_CAPTURE_TOKEN = 'test-carlab-capture-token';
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

function leadsStorage(): MemoryStorage {
  if (!memory.storages.has(LEADS_PATH))
    memory.storages.set(LEADS_PATH, createMemoryStorage());
  return memory.storages.get(LEADS_PATH)!;
}

function ledgerStorage(): MemoryStorage {
  if (!memory.storages.has(LEDGER_PATH))
    memory.storages.set(LEDGER_PATH, createMemoryStorage());
  return memory.storages.get(LEDGER_PATH)!;
}

function makeLead(overrides: Partial<StoredLead> = {}): StoredLead {
  return {
    id: 5,
    brand: 'Approved.rs',
    name: 'Иван',
    contact: '@ivan',
    service: 'vehicle-sourcing',
    services: ['vehicle-sourcing'],
    locale: 'ru',
    status: 'open',
    telegramChatId: CARD_CHAT_ID,
    telegramMessageId: CARD_MESSAGE_ID,
    statusChangedAt: '2026-01-01T00:00:00.000Z',
    lastActivityAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    pendingPrompt: null,
    capturePrompt: null,
    telegramId: null,
    referredBy: null,
    remindAt: null,
    ...overrides,
  };
}

function seed(...leads: StoredLead[]): void {
  leadsStorage().seed(leads);
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
  }: {
    id?: string;
    messageId?: number;
    chatId?: number;
    updateId?: number;
  } = {},
) {
  return POST(
    makeCtx({
      update_id: updateId,
      callback_query: {
        id,
        data,
        from: { id: from },
        message: { message_id: messageId, chat: { id: chatId } },
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

async function stored(id = 5): Promise<StoredLead> {
  const lead = await getLead(id);
  expect(lead).toBeDefined();
  return lead!;
}

describe('POST /api/telegram-webhook', () => {
  beforeEach(() => {
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
    seed(makeLead());
    ledgerStorage().seed({ operations: [], prompts: [] });
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

  it.each([
    ['wrong field types', { update_id: 'x', message: 5 }],
    ['a non-object', JSON.stringify('just a string')],
    ['a callback without an id', { callback_query: { data: 'st:5:won' } }],
    [
      'an update without an update_id',
      {
        callback_query: {
          id: 'cb-noid',
          data: 'st:5:lost',
          from: { id: OWNER_ID },
          message: { message_id: 1, chat: { id: DM_CHAT_ID } },
        },
      },
    ],
  ])(
    'acks with 200 on a well-formed JSON body of the wrong shape (%s) without running a handler',
    async (_label, body) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const before = leadsStorage().writeAttempts();
      const res = await POST(makeCtx(body));
      expect(res.status).toBe(200);
      expect(warn).toHaveBeenCalledOnce();
      expect(api.calls).toEqual([]);
      expect(leadsStorage().writeAttempts()).toBe(before);
      warn.mockRestore();
    },
  );

  describe('duplicate delivery — same update_id is only processed once', () => {
    it('skips a redelivered update_id instead of writing twice', async () => {
      const first = await tap('st:5:lost', OWNER_ID, { updateId: 918273645 });
      const writes = leadsStorage().writeAttempts();
      const calls = api.calls.length;
      const second = await tap('st:5:lost', OWNER_ID, { updateId: 918273645 });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(leadsStorage().writeAttempts()).toBe(writes);
      expect(api.calls).toHaveLength(calls);
      expect(answers()).toEqual([
        { callback_query_id: 'cb', text: 'Статус обновлён' },
      ]);
    });
  });

  describe('trust boundary — callbacks are gated on from.id, not chat', () => {
    it('rejects a status callback from someone who is neither owner nor admin', async () => {
      const res = await tap('st:5:lost', OTHER_ID, { id: 'cb-x' });
      expect(res.status).toBe(200);
      expect((await stored()).status).toBe('open');
      expect(answers()).toEqual([{ callback_query_id: 'cb-x' }]);
    });
  });

  describe('status callbacks (st:<id>:<key>)', () => {
    it('admin cannot finalize (won) — the owner closes deals', async () => {
      await tap('st:5:won', ADMIN_ID);
      expect((await stored()).status).toBe('open');
    });

    it('admin cannot finalize (lost)', async () => {
      await tap('st:5:lost', ADMIN_ID);
      expect((await stored()).status).toBe('open');
    });

    it('sets status directly for in_progress/lost and refreshes both surfaces', async () => {
      const res = await tap('st:5:lost', OWNER_ID, {
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
      expect(sentTo(ADMIN_ID)).toHaveLength(1);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-1', text: 'Статус обновлён' },
      ]);
    });

    it('marks won at once, refreshes both surfaces, unpins the card and asks for no amount', async () => {
      await tap('st:5:won', OWNER_ID, { id: 'cb-2', messageId: 556 });
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
      seed(makeLead({ status: 'won', statusChangedAt: PAID_AT }));
      const writes = leadsStorage().writeAttempts();
      await tap('st:5:won', OWNER_ID);
      expect(leadsStorage().writeAttempts()).toBe(writes);
      expect(crm('editMessageText')).toEqual([]);
      expect(crm('unpinChatMessage')).toEqual([]);
      expect(forceReplies()).toEqual([]);
    });

    it('does nothing when the lead is not found', async () => {
      const writes = leadsStorage().writeAttempts();
      await tap('st:99:in_progress', OWNER_ID, { id: 'cb-3' });
      expect(leadsStorage().writeAttempts()).toBe(writes);
      expect(answers()).toEqual([{ callback_query_id: 'cb-3' }]);
    });

    it('acks without updating for an unrecognized status key', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await tap('st:5:bogus', OWNER_ID, { id: 'cb-4' });
      expect((await stored()).status).toBe('open');
      expect(answers()).toEqual([{ callback_query_id: 'cb-4' }]);
      warn.mockRestore();
    });

    it('acks with an error message and does not throw if the store write fails', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(leadsStorage(), 'write').mockRejectedValueOnce(
        new Error('down'),
      );
      const res = await tap('st:5:lost', OWNER_ID, { id: 'cb-5' });
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
      await tap('won:5', OWNER_ID, { id: 'cb-won', ...onCard });

      expect(await stored()).toMatchObject({
        status: 'won',
        pendingPrompt: null,
      });
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toEqual([
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              [
                { text: '✅ Сделка', callback_data: 'won:5' },
                { text: '❌ Отказ', callback_data: 'lost:5' },
                { text: '⏳ В работе', callback_data: 'work:5' },
              ],
            ]),
          }),
        }),
      ]);
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
      await tap('lost:5', OWNER_ID, { id: 'cb-lost', ...onCard });

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
      seed(makeLead({ status: 'lost' }));
      const writes = leadsStorage().writeAttempts();
      await tap('lost:5', OWNER_ID, onCard);
      expect(leadsStorage().writeAttempts()).toBe(writes);
      expect(crm('unpinChatMessage')).toEqual([]);
    });

    it('⏳ records activity without changing the outcome or the pin', async () => {
      await tap('work:5', OWNER_ID, { id: 'cb-work', ...onCard });

      const lead = await stored();
      expect(lead).toMatchObject({
        status: 'open',
        statusChangedAt: '2026-01-01T00:00:00.000Z',
      });
      expect(lead.lastActivityAt).toEqual(expect.any(String));
      expect(crm('editMessageText')).toEqual([]);
      expect(crm('unpinChatMessage')).toEqual([]);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-work', text: 'В работе ⏳' },
      ]);
    });

    it('re-posts a won lead whose card is gone without pinning it', async () => {
      api.fail('editMessageText', 'Bad Request: message to edit not found');
      await tap('won:5', OWNER_ID, onCard);
      expect(crm('pinChatMessage')).toEqual([]);
      expect(sentTo(GROUP_ID)).toHaveLength(1);
    });

    it.each(['won:5', 'lost:5', 'work:5'])(
      '%s from the admin is refused',
      async (data) => {
        await tap(data, ADMIN_ID, { id: 'cb-admin', ...onCard });
        expect(await stored()).toMatchObject({
          status: 'open',
          lastActivityAt: null,
        });
        expect(crm('unpinChatMessage')).toEqual([]);
        expect(answers()).toEqual([{ callback_query_id: 'cb-admin' }]);
      },
    );

    it.each(['won:99', 'lost:99'])(
      '%s for an unknown lead is a bare ack',
      async (data) => {
        await tap(data, OWNER_ID, { id: 'cb-none', ...onCard });
        expect(answers()).toEqual([{ callback_query_id: 'cb-none' }]);
        expect(forceReplies()).toEqual([]);
      },
    );
  });

  describe('Bot API errors the edits swallow', () => {
    it('treats "message is not modified" as a successful edit', async () => {
      api.fail(
        'editMessageText',
        'Bad Request: message is not modified: specified new message content and reply markup are exactly the same',
      );
      await tap('st:5:lost', OWNER_ID, { id: 'cb-nm' });
      expect((await stored()).status).toBe('lost');
      expect(crm('editMessageText')).toHaveLength(2);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-nm', text: 'Статус обновлён' },
      ]);
    });

    it('posts a fresh group card when the old one is gone ("message to edit not found")', async () => {
      api.fail('editMessageText', 'Bad Request: message to edit not found');
      seed(makeLead({ pendingPrompt: awaiting('postpone') }));

      await answerPrompt(LATER);

      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(sentTo(GROUP_ID)).toHaveLength(1);
      expect(crm('pinChatMessage')).toEqual([
        expect.objectContaining({
          chat_id: Number(GROUP_ID),
          message_id: PROMPT_ID,
        }),
      ]);
      expect(await stored()).toMatchObject({
        status: 'postponed',
        telegramChatId: Number(GROUP_ID),
        telegramMessageId: PROMPT_ID,
      });
    });

    it('still fails the tap on any other edit error', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.fail('editMessageText', 'Bad Request: chat not found');
      await tap('st:5:lost', OWNER_ID, { id: 'cb-err' });
      expect(answers()).toEqual([
        { callback_query_id: 'cb-err', text: 'Ошибка, попробуйте ещё раз' },
      ]);
      error.mockRestore();
    });
  });

  describe('postpone: — owner only, opens the picker in place of the card', () => {
    it('replaces the card with the quick-pick/calendar/type menu', async () => {
      await tap('postpone:5', OWNER_ID, { id: 'cb-pp1' });
      const picker = buildRemindPicker(5);
      expect(edits(DM_CHAT_ID, 1)).toEqual([view(picker)]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-pp1' }]);
    });

    it('admin cannot postpone', async () => {
      await tap('postpone:5', ADMIN_ID);
      expect(crm('editMessageText')).toEqual([]);
    });

    it('acks without opening the picker when the lead is not found', async () => {
      seed();
      await tap('postpone:5', OWNER_ID, { id: 'cb-pp3' });
      expect(crm('editMessageText')).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-pp3' }]);
    });
  });

  describe('remindpick: — quick preset, applies immediately', () => {
    it('postpones with a date N days out and refreshes both surfaces', async () => {
      await tap('remindpick:5:7', OWNER_ID, { id: 'cb-rp1' });
      const lead = await stored();
      expect(lead).toMatchObject({
        status: 'postponed',
        remindAt: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        comment: expect.stringContaining('Отложено до'),
      });
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(edits(DM_CHAT_ID, 1)).toHaveLength(1);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-rp1', text: 'Отложено' },
      ]);
    });

    it('admin cannot use a quick pick', async () => {
      await tap('remindpick:5:7', ADMIN_ID);
      expect((await stored()).status).toBe('open');
    });

    it('acks without refreshing anything when the lead cannot be postponed', async () => {
      seed(makeLead({ status: 'lost' }));
      await tap('remindpick:5:7', OWNER_ID, { id: 'cb-rp3' });
      expect((await stored()).status).toBe('lost');
      expect(crm('editMessageText')).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-rp3' }]);
    });
  });

  describe('remindtype: — falls back to the typed-date prompt', () => {
    it('sends the date prompt and remembers it as a "postpone" pending prompt', async () => {
      await tap('remindtype:5', OWNER_ID, { id: 'cb-rt1' });
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
      seed();
      await tap('remindtype:5', OWNER_ID, { id: 'cb-rt2' });
      expect(forceReplies()).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-rt2' }]);
    });
  });

  describe('remindcancel: — back out to the normal lead card', () => {
    it('restores the detail view without postponing', async () => {
      await tap('remindcancel:5', OWNER_ID);
      const lead = await stored();
      expect(lead.status).toBe('open');
      expect(edits(DM_CHAT_ID, 1)).toEqual([
        view(buildLeadDetail(lead, 'owner')),
      ]);
    });
  });

  describe('resume: — either role, reopens a postponed lead', () => {
    const postponed = () =>
      makeLead({ status: 'postponed', remindAt: '2099-10-20' });

    it('owner can resume', async () => {
      seed(postponed());
      await tap('resume:5', OWNER_ID, { id: 'cb-rs1' });
      expect(await stored()).toMatchObject({
        status: 'open',
        remindAt: null,
      });
      expect(edits(DM_CHAT_ID, 1)).toHaveLength(1);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-rs1', text: 'Возобновлено' },
      ]);
    });

    it('admin can resume too', async () => {
      seed(postponed());
      await tap('resume:5', ADMIN_ID);
      expect((await stored()).status).toBe('open');
    });
  });

  describe('del: / delconfirm: / delcancel: — admin only, permanent delete', () => {
    it('del:<id> shows a confirm prompt in place, does not delete yet', async () => {
      await tap('del:5', ADMIN_ID);
      const lead = await stored();
      expect(edits(DM_CHAT_ID, 1)).toEqual([view(buildDeleteConfirm(lead))]);
    });

    it('owner cannot even open the confirm prompt', async () => {
      await tap('del:5', OWNER_ID);
      expect(crm('editMessageText')).toEqual([]);
    });

    it('delconfirm:<id> actually deletes and clears the message', async () => {
      await tap('delconfirm:5', ADMIN_ID, { id: 'cb-del3' });
      expect(await getLead(5)).toBeUndefined();
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
      await tap('delconfirm:5', OWNER_ID);
      expect(await getLead(5)).toBeDefined();
    });

    it('delcancel:<id> restores the normal detail view without deleting', async () => {
      await tap('delcancel:5', ADMIN_ID);
      const lead = await stored();
      expect(edits(DM_CHAT_ID, 1)).toEqual([
        view(buildLeadDetail(lead, 'admin')),
      ]);
    });
  });

  describe('reply:<id>', () => {
    it('starts a reply-to-visitor prompt', async () => {
      seed(makeLead({ contact: 'tg://user?id=4242', telegramId: 4242 }));
      await tap('reply:5', OWNER_ID);
      expect(forceReplies()).toEqual([
        expect.objectContaining({
          text: expect.stringContaining('посетителю'),
        }),
      ]);
      expect((await stored()).pendingPrompt).toEqual(awaiting('reply_visitor'));
    });
  });

  describe('menu:open / open: / menu:stats', () => {
    it('menu:open lists open and postponed Leads, never lost ones', async () => {
      seed(
        makeLead({ id: 5 }),
        makeLead({ id: 6, status: 'postponed' }),
        makeLead({ id: 7, status: 'lost' }),
        makeLead({ id: 8, status: 'won' }),
      );
      await tap('menu:open', OWNER_ID);
      expect(sentTo(DM_CHAT_ID)).toEqual([
        view(buildOpenList(await readLeads())),
      ]);
      expect(
        buildOpenList(await readLeads()).reply_markup.inline_keyboard.map(
          ([b]) => b!.callback_data,
        ),
      ).toEqual(['open:6', 'open:5']);
    });

    it("open:<id> sends the detail view for the tapper's role", async () => {
      await tap('open:5', ADMIN_ID);
      expect(sentTo(DM_CHAT_ID)).toEqual([
        view(buildLeadDetail(await stored(), 'admin')),
      ]);
    });

    it('open:<id> for a missing lead just acks', async () => {
      await tap('open:404', OWNER_ID, { id: 'cb-19' });
      expect(crm('sendMessage')).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-19' }]);
    });

    it('menu:stats sends the stats view to the admin', async () => {
      await tap('menu:stats', ADMIN_ID, { chatId: ADMIN_ID });
      expect(textsTo(ADMIN_ID)).toEqual([buildStats(await readLeads())]);
    });

    it('ignores menu:stats from the owner', async () => {
      await tap('menu:stats', OWNER_ID, { id: 'cb-st', chatId: OWNER_ID });
      expect(crm('sendMessage')).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-st' }]);
    });
  });

  describe('menu:debt — the Balance, both roles', () => {
    it.each([
      [ADMIN_ID, 'admin'],
      [OWNER_ID, 'owner'],
    ] as const)('shows %i the %s Balance with ➕/➖', async (who, role) => {
      await recordOperation({ type: 'payout', amount: 80, by: 'owner' });
      await recordOperation({ type: 'settlement', amount: 30, by: 'admin' });
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
        const writes = leadsStorage().writeAttempts();
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
        expect(leadsStorage().writeAttempts()).toBe(writes);
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
      await recordOperation({ type: 'payout', amount: 80, by: 'owner' });
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

    it('refuses a debit above the Balance, naming the Balance, and stores nothing', async () => {
      await recordOperation({ type: 'payout', amount: 10, by: 'owner' });
      await ask(OWNER_ID, 'settlement');
      await answerAs(OWNER_ID, '30');
      expect(textsTo(OWNER_ID)).toEqual([operationRefusedText(10)]);
      expect(textsTo(ADMIN_ID)).toEqual([]);
      expect(await readOperations()).toHaveLength(1);
    });

    it('asks again when the reply has no amount', async () => {
      await ask(OWNER_ID, 'settlement');
      await answerAs(OWNER_ID, 'Иван сервис');
      expect(forceReplies()).toEqual([
        expect.objectContaining({
          chat_id: OWNER_ID,
          text: reAskOperationText('settlement'),
        }),
      ]);
      expect(await readOperations()).toEqual([]);
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
      expect(api.calls).toEqual([]);
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

  it('acks without acting when a callback has no message attached', async () => {
    await POST(
      makeCtx({
        update_id: 2_400_000_024,
        callback_query: {
          id: 'cb-24',
          data: 'st:5:won',
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
      'arch:5',
      'unarch:5',
      'edit:5:name',
      'st:5:in_progress',
      'list:new',
      'menu:deals',
      '',
      'pay:5',
      'payfix:1',
      'settle:other',
      'settle:12.5',
    ])('%j falls through to unrecognized', async (data) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const before = await stored();
      await tap(data, data === 'pay:5' ? ADMIN_ID : OWNER_ID, {
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
      ['st:5:won', 'owner'],
      ['st:5:lost', 'owner'],
      ['won:5', 'owner'],
      ['lost:5', 'owner'],
      ['work:5', 'owner'],
      ['postpone:5', 'owner'],
      ['remindpick:5:3', 'owner'],
      ['remindtype:5', 'owner'],
      ['remindcancel:5', 'owner'],
      ['resume:5', 'any'],
      ['del:5', 'admin'],
      ['delconfirm:5', 'admin'],
      ['delcancel:5', 'admin'],
      ['reply:5', 'any'],
      ['menu:open', 'any'],
      ['open:5', 'any'],
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
      '%s refuses the other role with a bare ack',
      async (data, role) => {
        const before = leadsStorage().current();
        const writes = leadsStorage().writeAttempts();
        await tap(data, role === 'owner' ? ADMIN_ID : OWNER_ID, {
          id: 'cb-table',
        });
        expect(api.calls.map((c) => c.method)).toEqual(['answerCallbackQuery']);
        expect(answers()).toEqual([{ callback_query_id: 'cb-table' }]);
        expect(leadsStorage().writeAttempts()).toBe(writes);
        expect(leadsStorage().current()).toEqual(before);
      },
    );

    it('passes the captured groups to the handler', async () => {
      seed(makeLead(), makeLead({ id: 6 }));
      await tap('remindpick:6:3', OWNER_ID);
      expect(await stored(6)).toMatchObject({
        status: 'postponed',
        remindAt: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
      });
      expect((await stored(5)).status).toBe('open');
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
      await message('/start lead_5', OWNER_ID);
      expect(sentTo(OWNER_ID)).toEqual([
        view(buildLeadDetail(await stored(), 'owner')),
      ]);
    });

    it('/start lead_<id> for an unknown lead falls back to the menu', async () => {
      await message('/start lead_404', OWNER_ID);
      expect(sentTo(OWNER_ID)).toEqual([view(buildMenu('owner', 0))]);
    });

    it('/start lead_<id> denies an unauthorized sender even with a valid payload', async () => {
      await message('/start lead_5', OTHER_ID);
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
      leadsStorage().seed([
        {
          ...makeLead({ status: 'won' }),
          pendingPrompt: { ...awaiting('postpone'), kind: 'deal_amount' },
        },
      ]);

      await answerPrompt('150');

      expect(api.calls).toEqual([]);
      expect(await readOperations()).toEqual([]);
      expect((await stored()).pendingPrompt).toBeNull();
    });

    it('postpones with the given date, appends a comment note, and notifies the admin', async () => {
      seed(
        makeLead({ comment: 'BMW X5', pendingPrompt: awaiting('postpone') }),
      );
      await answerPrompt(LATER);
      expect(await stored()).toMatchObject({
        status: 'postponed',
        remindAt: '2099-10-20',
        comment: `BMW X5\nОтложено до ${LATER}`,
      });
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(sentTo(ADMIN_ID)).toHaveLength(1);
    });

    it('does not postpone via typed reply if the lead moved on while the prompt sat unanswered (stale guard)', async () => {
      seed(makeLead({ status: 'won', pendingPrompt: awaiting('postpone') }));
      await answerPrompt(LATER);
      expect((await stored()).status).toBe('won');
      expect(crm('editMessageText')).toEqual([]);
      expect(sentTo(ADMIN_ID)).toEqual([]);
    });

    it.each([
      ['a malformed date', 'завтра'],
      ['a past date', '01.01.2020'],
      ['an impossible calendar date', '31.02.2099'],
    ])('rejects %s without resolving the prompt', async (_label, text) => {
      seed(makeLead({ pendingPrompt: awaiting('postpone') }));
      await answerPrompt(text);
      expect(await stored()).toMatchObject({
        status: 'open',
        pendingPrompt: awaiting('postpone'),
      });
      expect(textsTo(DM_CHAT_ID)).toEqual([
        expect.stringContaining('ДД.ММ.ГГГГ'),
      ]);
    });

    it('drops a field-edit prompt left over from before the edit buttons went', async () => {
      leadsStorage().seed([
        {
          ...makeLead({ name: 'Old' }),
          pendingPrompt: { ...awaiting('postpone'), kind: 'edit_name' },
        },
      ]);
      await answerPrompt('Новое Имя');
      expect(await stored()).toMatchObject({
        name: 'Old',
        pendingPrompt: null,
      });
      expect(api.calls).toEqual([]);
    });

    it('ignores a reply that matches no pending prompt', async () => {
      await message('random reply', OWNER_ID, { replyTo: 42 });
      expect(api.calls).toEqual([]);
    });

    it('reply correlation is attempted regardless of chat type (not gated behind private-only) — defense in depth', async () => {
      seed(
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

  describe('replying to a visitor through the capture bot', () => {
    const visitorLead = (overrides: Partial<StoredLead> = {}) =>
      makeLead({
        contact: 'tg://user?id=4242',
        telegramId: 4242,
        comment: 'Ищу Golf 7',
        pendingPrompt: awaiting('reply_visitor'),
        ...overrides,
      });

    const captureSends = (token: string) =>
      api.callsTo('sendMessage', token).map((c) => c.payload);

    it('goes to the visitor through the capture bot, not into a lead field', async () => {
      seed(visitorLead());
      const before = await stored();

      await answerPrompt('Нашёл вариант <до 10k>');

      expect(captureSends(APPROVED_CAPTURE_TOKEN)).toEqual([
        {
          chat_id: 4242,
          text: 'Нашёл вариант &lt;до 10k&gt;',
          parse_mode: 'HTML',
        },
      ]);
      expect(captureSends(CARLAB_CAPTURE_TOKEN)).toEqual([]);
      expect(sentTo(4242)).toEqual([]);
      const lead = await stored();
      expect(lead).toEqual({
        ...before,
        comment: 'Ищу Golf 7\nОтвет: Нашёл вариант <до 10k>',
        pendingPrompt: null,
        lastActivityAt: expect.any(String),
      });
      expect(sentTo(ADMIN_ID)).toEqual([]);
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(sentTo(DM_CHAT_ID)).toEqual([
        view({
          text: `✅ Отправлено\n\n${buildLeadDetail(lead, 'owner').text}`,
          reply_markup: buildLeadDetail(lead, 'owner').reply_markup,
        }),
      ]);
    });

    it("sends a sibling brand's reply through that brand's capture bot", async () => {
      seed(visitorLead({ brand: 'CarLab' }));

      await answerPrompt('Запчасть есть');

      expect(captureSends(CARLAB_CAPTURE_TOKEN)).toEqual([
        expect.objectContaining({ chat_id: 4242, text: 'Запчасть есть' }),
      ]);
      expect(captureSends(APPROVED_CAPTURE_TOKEN)).toEqual([]);
      expect((await stored()).pendingPrompt).toBeNull();
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
    });

    it('reports a reply the capture bot could not deliver instead of recording it', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.respond(
        'sendMessage',
        (payload: Record<string, unknown>): BotApiResponse =>
          payload.chat_id === 4242
            ? {
                ok: false,
                error_code: 403,
                description: 'Forbidden: bot was blocked by the user',
              }
            : {
                ok: true,
                result: { message_id: 1, chat: { id: payload.chat_id } },
              },
      );
      seed(visitorLead());

      await answerPrompt('Нашёл вариант');

      expect(captureSends(APPROVED_CAPTURE_TOKEN)).toHaveLength(1);
      expect((await stored()).pendingPrompt).toEqual(awaiting('reply_visitor'));
      expect(crm('editMessageText')).toEqual([]);
      expect(textsTo(DM_CHAT_ID)).toEqual([
        expect.stringContaining('Не доставлено'),
      ]);
      error.mockRestore();
    });

    it.each([
      ['the brand has no capture bot configured', { brand: 'Details' }],
      ['the lead carries no telegramId', { telegramId: null }],
    ])(
      'reports a reply as undelivered when %s',
      async (_label, overrides: Partial<StoredLead>) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        seed(visitorLead(overrides));

        await answerPrompt('Нашёл вариант');

        expect(captureSends(APPROVED_CAPTURE_TOKEN)).toEqual([]);
        expect(captureSends(CARLAB_CAPTURE_TOKEN)).toEqual([]);
        expect((await stored()).pendingPrompt).toEqual(
          awaiting('reply_visitor'),
        );
        expect(textsTo(DM_CHAT_ID)).toEqual([
          expect.stringContaining('Не доставлено'),
        ]);
        warn.mockRestore();
      },
    );

    it('rejects an empty reply to the visitor', async () => {
      seed(visitorLead());
      await answerPrompt('   ');
      expect(captureSends(APPROVED_CAPTURE_TOKEN)).toEqual([]);
      expect((await stored()).pendingPrompt).toEqual(awaiting('reply_visitor'));
      expect(textsTo(DM_CHAT_ID)).toEqual([expect.stringContaining('пустым')]);
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
      seed(makeLead({ status: 'lost', name: 'Марко' }));
      await message('марко', OWNER_ID);
      const results = await searchLeads('марко');
      expect(results.map((l) => [l.id, l.status])).toEqual([[5, 'lost']]);
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

    it('keeps a number as a note and moves no money', async () => {
      seed(makeLead({ comment: 'Звонил' }));
      await cardReply('80');

      expect((await stored()).comment).toBe('Звонил\n80');
      expect(await readOperations()).toEqual([]);
      expect(sentTo(CARD_CHAT_ID)).toEqual([
        expect.objectContaining({
          text: '📝 Заметка добавлена',
          reply_parameters: expect.objectContaining({ message_id: 2 }),
        }),
      ]);
      expect(sentTo(ADMIN_ID)).toEqual([]);
      expect((await stored()).lastActivityAt).not.toBeNull();
    });

    it('appends any other text to the Lead as a note', async () => {
      await cardReply('Иван 30, приедет в пятницу', ADMIN_ID);
      expect((await stored()).comment).toBe('Иван 30, приедет в пятницу');
    });

    it('leaves a lost Lead lost', async () => {
      seed(makeLead({ status: 'lost' }));
      await cardReply('50');
      expect((await stored()).status).toBe('lost');
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toEqual([]);
    });

    it('ignores a reply with no text', async () => {
      await cardReply('  ');
      expect(api.calls).toEqual([]);
      expect((await stored()).comment).toBeUndefined();
    });

    it('ignores a reply from someone who is neither owner nor admin', async () => {
      await cardReply('80', OTHER_ID);
      expect(api.calls).toEqual([]);
      expect((await stored()).comment).toBeUndefined();
    });

    it('ignores an owner or admin reply to any other message', async () => {
      for (const from of [OWNER_ID, ADMIN_ID])
        await message('Петя 40', from, {
          chatId: CARD_CHAT_ID,
          type: 'supergroup',
          replyTo: 4242,
        });
      expect(api.calls).toEqual([]);
    });

    it('gives a pending prompt priority over the card', async () => {
      seed(
        makeLead({
          pendingPrompt: {
            chatId: CARD_CHAT_ID,
            messageId: CARD_MESSAGE_ID,
            kind: 'postpone',
          },
        }),
      );
      await cardReply('80');
      expect((await stored()).comment).toBeUndefined();
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
