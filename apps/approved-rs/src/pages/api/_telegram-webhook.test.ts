import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { addDays, format } from 'date-fns';
import { LEADS_PATH } from '@podbor/lead-crm';
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
  buildLeadList,
  buildMenu,
  buildOwedList,
  buildRemindPicker,
  buildSearchResults,
  buildStats,
  formatDealsList,
} from '@/lib/telegram';
import { getLead, getOwedSummary, readLeads, searchLeads } from '@/lib/store';

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

function makeLead(overrides: Partial<StoredLead> = {}): StoredLead {
  return {
    id: 5,
    brand: 'Approved.rs',
    name: 'Иван',
    contact: '@ivan',
    service: 'vehicle-sourcing',
    services: ['vehicle-sourcing'],
    locale: 'ru',
    status: 'in_progress',
    dealAmount: null,
    commissionPercent: 10,
    paidAmount: 0,
    payments: [],
    telegramChatId: CARD_CHAT_ID,
    telegramMessageId: CARD_MESSAGE_ID,
    statusChangedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    pendingPrompt: null,
    capturePrompt: null,
    telegramId: null,
    referredBy: null,
    archived: false,
    pendingCommissionClaim: null,
    remindAt: null,
    postponedFrom: null,
    incomes: [],
    ...overrides,
  };
}

function seed(...leads: StoredLead[]): void {
  leadsStorage().seed(leads);
}

function income(id: number, amount: number, paidAt: string | null = null) {
  return { id, amount, at: '2026-01-01T00:00:00.000Z', paidAt };
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
  }: { chatId?: number; type?: string; replyTo?: number } = {},
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
      expect((await stored()).status).toBe('in_progress');
      expect(answers()).toEqual([{ callback_query_id: 'cb-x' }]);
    });
  });

  describe('status callbacks (st:<id>:<key>)', () => {
    it('admin cannot finalize (won) — only the owner knows the deal amount', async () => {
      await tap('st:5:won', ADMIN_ID);
      expect(forceReplies()).toEqual([]);
      expect(await stored()).toMatchObject({
        status: 'in_progress',
        pendingPrompt: null,
      });
    });

    it('admin cannot finalize (lost)', async () => {
      await tap('st:5:lost', ADMIN_ID);
      expect((await stored()).status).toBe('in_progress');
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

    it('starts a deal-amount prompt on "won" instead of setting status directly, when no amount is set yet', async () => {
      await tap('st:5:won', OWNER_ID, { id: 'cb-2' });
      expect(forceReplies()).toEqual([
        expect.objectContaining({
          chat_id: DM_CHAT_ID,
          text: expect.stringContaining('заработал'),
        }),
      ]);
      expect(await stored()).toMatchObject({
        status: 'in_progress',
        pendingPrompt: awaiting('deal_amount'),
      });
      expect(answers()).toEqual([
        { callback_query_id: 'cb-2', text: 'Жду сумму' },
      ]);
      expect(crm('editMessageText')).toEqual([]);
    });

    it('asks for the amount on top when prepayments are already booked', async () => {
      seed(makeLead({ incomes: [income(1, 50000)] }));
      await tap('st:5:won', OWNER_ID);
      expect(forceReplies()).toEqual([
        expect.objectContaining({ text: expect.stringContaining('сверх') }),
      ]);
    });

    it('does not re-open the amount prompt on a stale "won" button for a closed deal', async () => {
      seed(
        makeLead({
          status: 'won',
          dealAmount: 50000,
          incomes: [income(1, 50000)],
        }),
      );
      await tap('st:5:won', OWNER_ID);
      expect(forceReplies()).toEqual([]);
      expect((await stored()).pendingPrompt).toBeNull();
    });

    it('resends a fresh deal-amount prompt on a second "won" tap, replacing a stale pending one', async () => {
      seed(
        makeLead({
          pendingPrompt: { ...awaiting('deal_amount'), messageId: 500 },
        }),
      );
      await tap('st:5:won', OWNER_ID, { id: 'cb-2b' });
      expect(forceReplies()).toHaveLength(1);
      expect((await stored()).pendingPrompt).toEqual(awaiting('deal_amount'));
      expect(answers()).toEqual([
        { callback_query_id: 'cb-2b', text: 'Жду сумму' },
      ]);
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
      expect((await stored()).status).toBe('in_progress');
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

  describe('Bot API errors the edits swallow', () => {
    it('treats "message is not modified" as a successful edit', async () => {
      api.fail(
        'editMessageText',
        'Bad Request: message is not modified: specified new message content and reply markup are exactly the same',
      );
      await tap('arch:5', OWNER_ID, { id: 'cb-nm' });
      expect((await stored()).archived).toBe(true);
      expect(crm('editMessageText')).toHaveLength(2);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-nm', text: 'Архивировано' },
      ]);
    });

    it('posts a fresh group card when the old one is gone ("message to edit not found")', async () => {
      api.fail('editMessageText', 'Bad Request: message to edit not found');
      seed(makeLead({ pendingPrompt: awaiting('edit_name') }));

      await answerPrompt('Пётр');

      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(sentTo(GROUP_ID)).toHaveLength(1);
      expect(crm('pinChatMessage')).toEqual([
        expect.objectContaining({
          chat_id: Number(GROUP_ID),
          message_id: PROMPT_ID,
        }),
      ]);
      expect(await stored()).toMatchObject({
        name: 'Пётр',
        telegramChatId: Number(GROUP_ID),
        telegramMessageId: PROMPT_ID,
      });
      expect(textsTo(DM_CHAT_ID)).toEqual([
        expect.stringContaining('✅ Обновлено'),
      ]);
    });

    it('still fails the tap on any other edit error', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.fail('editMessageText', 'Bad Request: chat not found');
      await tap('arch:5', OWNER_ID, { id: 'cb-err' });
      expect(answers()).toEqual([
        { callback_query_id: 'cb-err', text: 'Ошибка, попробуйте ещё раз' },
      ]);
      error.mockRestore();
    });
  });

  describe('archive / unarchive', () => {
    it('arch:<id> archives and refreshes both surfaces', async () => {
      await tap('arch:5', OWNER_ID, { id: 'cb-6' });
      expect((await stored()).archived).toBe(true);
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(edits(DM_CHAT_ID, 1)).toHaveLength(1);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-6', text: 'Архивировано' },
      ]);
    });

    it('unarch:<id> restores and refreshes both surfaces', async () => {
      seed(makeLead({ archived: true }));
      await tap('unarch:5', ADMIN_ID, { id: 'cb-7' });
      expect((await stored()).archived).toBe(false);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-7', text: 'Восстановлено' },
      ]);
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
      expect((await stored()).status).toBe('in_progress');
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
      expect(lead.status).toBe('in_progress');
      expect(edits(DM_CHAT_ID, 1)).toEqual([
        view(buildLeadDetail(lead, 'owner')),
      ]);
    });
  });

  describe('resume: — either role, returns a postponed lead to in_progress', () => {
    const postponed = () =>
      makeLead({
        status: 'postponed',
        remindAt: '2099-10-20',
        postponedFrom: 'in_progress',
      });

    it('owner can resume', async () => {
      seed(postponed());
      await tap('resume:5', OWNER_ID, { id: 'cb-rs1' });
      expect(await stored()).toMatchObject({
        status: 'in_progress',
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
      expect((await stored()).status).toBe('in_progress');
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

  describe('income:<id> — owner only', () => {
    it('opens an amount prompt the owner can answer mid-job', async () => {
      seed(makeLead({ id: 9 }));
      await tap('income:9', OWNER_ID);
      expect(forceReplies()).toEqual([
        expect.objectContaining({ text: expect.stringContaining('получил') }),
      ]);
      expect((await stored(9)).pendingPrompt).toEqual(awaiting('add_income'));
    });

    it('acks an unknown lead without prompting', async () => {
      await tap('income:9', OWNER_ID, { id: 'cb-inc2' });
      expect(forceReplies()).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-inc2' }]);
    });

    it('ignores a stale add-income button on a lead nobody is working on', async () => {
      seed(makeLead({ id: 9, status: 'lost' }));
      await tap('income:9', OWNER_ID);
      expect(forceReplies()).toEqual([]);
      expect((await stored(9)).pendingPrompt).toBeNull();
    });

    it('admin cannot add an income', async () => {
      seed(makeLead({ id: 9 }));
      await tap('income:9', ADMIN_ID);
      expect((await stored(9)).pendingPrompt).toBeNull();
    });
  });

  describe('claimpay:<id> — owner only', () => {
    const won = (overrides: Partial<StoredLead> = {}) =>
      makeLead({
        id: 9,
        status: 'won',
        dealAmount: 1000,
        incomes: [income(1, 1000)],
        ...overrides,
      });

    it('owner claims the full remaining balance immediately, no amount prompt', async () => {
      seed(won());
      await tap('claimpay:9', OWNER_ID, { id: 'cb-10' });
      expect(forceReplies()).toEqual([]);
      const lead = await stored(9);
      expect(lead.pendingCommissionClaim).toMatchObject({
        amount: 100,
        incomeIds: [1],
      });
      expect(sentTo(ADMIN_ID)).toEqual([
        expect.objectContaining({
          reply_markup: {
            inline_keyboard: [
              [
                expect.objectContaining({ callback_data: 'confirmpay:9' }),
                expect.objectContaining({ callback_data: 'rejectpay:9' }),
              ],
            ],
          },
        }),
      ]);
      expect(answers()).toEqual([
        { callback_query_id: 'cb-10', text: 'Отмечено — ждём подтверждения' },
      ]);
    });

    it('claims just the income the owner tapped', async () => {
      seed(won({ incomes: [income(1, 300, PAID_AT), income(2, 200)] }));
      await tap('claimpay:9:2', OWNER_ID);
      expect((await stored(9)).pendingCommissionClaim).toMatchObject({
        amount: 20,
        incomeIds: [2],
      });
    });

    it('tells nobody when the store reports the income was already settled', async () => {
      seed(won({ dealAmount: 300, incomes: [income(1, 300, PAID_AT)] }));
      await tap('claimpay:9:1', OWNER_ID, { id: 'cb-10c' });
      expect((await stored(9)).pendingCommissionClaim).toBeNull();
      expect(sentTo(ADMIN_ID)).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-10c' }]);
    });

    it('acks without claiming once nothing remains', async () => {
      seed(won({ incomes: [income(1, 1000, PAID_AT)] }));
      await tap('claimpay:9', OWNER_ID);
      expect((await stored(9)).pendingCommissionClaim).toBeNull();
      expect(sentTo(ADMIN_ID)).toEqual([]);
    });

    it('admin cannot claim', async () => {
      seed(won());
      await tap('claimpay:9', ADMIN_ID);
      expect((await stored(9)).pendingCommissionClaim).toBeNull();
    });

    it('a second tap while a claim is already pending is a no-op, not a double-claim', async () => {
      const claim = {
        amount: 100,
        claimedAt: '2026-01-01T00:00:00.000Z',
        incomeIds: [1],
      };
      seed(won({ pendingCommissionClaim: claim }));
      await tap('claimpay:9', OWNER_ID);
      expect((await stored(9)).pendingCommissionClaim).toEqual(claim);
      expect(sentTo(ADMIN_ID)).toEqual([]);
    });
  });

  describe('confirmpay: / rejectpay: — admin only', () => {
    const claimed = () =>
      makeLead({
        status: 'won',
        dealAmount: 1000,
        incomes: [income(1, 1000)],
        pendingCommissionClaim: {
          amount: 100,
          claimedAt: '2026-01-02T00:00:00.000Z',
          incomeIds: [1],
        },
      });

    it('admin confirms: moves the money and tells the owner', async () => {
      seed(claimed());
      await tap('confirmpay:5', ADMIN_ID);
      const lead = await stored();
      expect(lead.pendingCommissionClaim).toBeNull();
      expect(lead.incomes[0]!.paidAt).not.toBeNull();
      expect(sentTo(OWNER_ID)).toHaveLength(1);
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
    });

    it('admin rejects: clears the claim and tells the owner', async () => {
      seed(claimed());
      await tap('rejectpay:5', ADMIN_ID);
      const lead = await stored();
      expect(lead.pendingCommissionClaim).toBeNull();
      expect(lead.incomes[0]!.paidAt).toBeNull();
      expect(sentTo(OWNER_ID)).toHaveLength(1);
    });

    it('owner cannot confirm or reject', async () => {
      seed(claimed());
      await tap('confirmpay:5', OWNER_ID);
      expect((await stored()).pendingCommissionClaim).not.toBeNull();
    });

    it.each(['confirmpay', 'rejectpay'])(
      'does not notify the owner a second time when %s is a no-op (duplicate delivery)',
      async (action) => {
        await tap(`${action}:5`, ADMIN_ID);
        expect(sentTo(OWNER_ID)).toEqual([]);
        expect(crm('editMessageText')).toEqual([]);
        expect(answers()).toEqual([{ callback_query_id: 'cb' }]);
      },
    );
  });

  describe('edit:<id>:<field>', () => {
    it('starts a field-edit prompt', async () => {
      await tap('edit:5:contact', OWNER_ID);
      expect(forceReplies()).toEqual([
        expect.objectContaining({
          chat_id: DM_CHAT_ID,
          text: expect.stringContaining('контакт'),
        }),
      ]);
      expect((await stored()).pendingPrompt).toEqual(awaiting('edit_contact'));
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

  describe('list: / open: / menu:stats', () => {
    it.each([
      ['list:new', ['new']],
      ['list:postponed', ['postponed']],
      ['list:in_progress+postponed', ['in_progress', 'postponed']],
    ] as const)('%s sends the filtered list', async (data, statuses) => {
      await tap(data, OWNER_ID);
      expect(sentTo(DM_CHAT_ID)).toEqual([
        view(buildLeadList(await readLeads(), [...statuses])),
      ]);
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

    it('menu:stats sends the stats view', async () => {
      await tap('menu:stats', OWNER_ID);
      expect(textsTo(DM_CHAT_ID)).toEqual([
        buildStats(await readLeads(), 'owner'),
      ]);
    });
  });

  describe('menu:debt — both roles', () => {
    it.each([ADMIN_ID, OWNER_ID])('shows the owed list to %i', async (who) => {
      seed(
        makeLead({
          status: 'won',
          dealAmount: 1000,
          incomes: [income(1, 1000)],
        }),
      );
      await tap('menu:debt', who, { chatId: who });
      const { rows, total } = await getOwedSummary();
      expect(rows).toHaveLength(1);
      expect(sentTo(who)).toEqual([view(buildOwedList(rows, total))]);
    });
  });

  describe('menu:deals — admin only', () => {
    it('shows the deals list to the admin', async () => {
      await tap('menu:deals', ADMIN_ID, { chatId: ADMIN_ID });
      expect(textsTo(ADMIN_ID)).toEqual([formatDealsList(await readLeads())]);
    });

    it('ignores menu:deals from the owner', async () => {
      await tap('menu:deals', OWNER_ID, { id: 'cb-22b', chatId: OWNER_ID });
      expect(crm('sendMessage')).toEqual([]);
      expect(answers()).toEqual([{ callback_query_id: 'cb-22b' }]);
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
      'arch:xx',
      'edit:5:bogus',
      'list:archived',
      '',
      'pay:5',
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
      ['st:5:negotiations', 'any'],
      ['st:5:in_progress', 'any'],
      ['st:5:won', 'owner'],
      ['st:5:lost', 'owner'],
      ['arch:5', 'any'],
      ['unarch:5', 'any'],
      ['postpone:5', 'owner'],
      ['remindpick:5:3', 'owner'],
      ['remindtype:5', 'owner'],
      ['remindcancel:5', 'owner'],
      ['resume:5', 'any'],
      ['del:5', 'admin'],
      ['delconfirm:5', 'admin'],
      ['delcancel:5', 'admin'],
      ['claimpay:5:7', 'owner'],
      ['income:5', 'owner'],
      ['confirmpay:5', 'admin'],
      ['rejectpay:5', 'admin'],
      ['edit:5:name', 'any'],
      ['edit:5:contact', 'any'],
      ['edit:5:comment', 'any'],
      ['reply:5', 'any'],
      ['list:in_progress+postponed', 'any'],
      ['open:5', 'any'],
      ['menu:stats', 'any'],
      ['menu:debt', 'any'],
      ['menu:deals', 'admin'],
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
      seed(
        makeLead({
          status: 'won',
          dealAmount: 1000,
          incomes: [income(6, 500), income(7, 500)],
        }),
        makeLead({ id: 6 }),
      );
      await tap('claimpay:5:7', OWNER_ID);
      expect((await stored(5)).pendingCommissionClaim?.incomeIds).toEqual([7]);

      await tap('edit:6:contact', ADMIN_ID);
      expect((await stored(6)).pendingPrompt?.kind).toBe('edit_contact');
      expect((await stored(5)).pendingPrompt).toBeNull();

      api.reset();
      await tap('list:in_progress+postponed', ADMIN_ID);
      expect(sentTo(DM_CHAT_ID)).toEqual([
        view(buildLeadList(await readLeads(), ['in_progress', 'postponed'])),
      ]);
    });
  });

  describe('/start in a private chat', () => {
    it.each([
      [OWNER_ID, 'owner'],
      [ADMIN_ID, 'admin'],
    ] as const)('shows %i the %s menu', async (who, role) => {
      await message('/start', who);
      expect(sentTo(who)).toEqual([view(buildMenu(role))]);
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
      expect(sentTo(OWNER_ID)).toEqual([view(buildMenu('owner'))]);
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
      expect(sentTo(who)).toEqual([view(buildMenu(role))]);
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
    it('completes the deal, refreshes the group card, and notifies the admin on a valid deal-amount reply', async () => {
      seed(makeLead({ pendingPrompt: awaiting('deal_amount') }));

      await answerPrompt('150000');

      const lead = await stored();
      expect(lead).toMatchObject({ status: 'won', pendingPrompt: null });
      expect(lead.incomes).toEqual([
        expect.objectContaining({ id: 1, amount: 150000, paidAt: null }),
      ]);
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(sentTo(ADMIN_ID)).toHaveLength(1);
      expect(sentTo(DM_CHAT_ID)).toEqual([]);
    });

    it('books the closing amount on top of the prepayments already taken', async () => {
      seed(
        makeLead({
          incomes: [income(1, 50000)],
          pendingPrompt: awaiting('deal_amount'),
        }),
      );
      await answerPrompt('100000');
      const lead = await stored();
      expect(lead.incomes.map((i) => i.amount)).toEqual([50000, 100000]);
      expect(lead.status).toBe('won');
    });

    it('accepts a zero closing amount when prepayments already cover the deal', async () => {
      seed(
        makeLead({
          incomes: [income(1, 50000)],
          pendingPrompt: awaiting('deal_amount'),
        }),
      );
      await answerPrompt('0');
      const lead = await stored();
      expect(lead.incomes.map((i) => i.amount)).toEqual([50000]);
      expect(lead.status).toBe('won');
      expect(textsTo(DM_CHAT_ID)).toEqual([]);
    });

    it('refuses a closing reply with no number in it, even when prepayments allow zero', async () => {
      seed(
        makeLead({
          incomes: [income(1, 50000)],
          pendingPrompt: awaiting('deal_amount'),
        }),
      );
      await answerPrompt('не знаю');
      expect((await stored()).pendingPrompt).toEqual(awaiting('deal_amount'));
      expect(textsTo(DM_CHAT_ID)).toEqual([expect.stringContaining('сумма')]);
    });

    it('records a mid-job income and tells the admin about it', async () => {
      seed(makeLead({ pendingPrompt: awaiting('add_income') }));
      await answerPrompt('300');
      const lead = await stored();
      expect(lead.incomes.map((i) => i.amount)).toEqual([300]);
      expect(lead.status).toBe('in_progress');
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(sentTo(ADMIN_ID)).toHaveLength(1);
      expect(textsTo(DM_CHAT_ID)).toEqual([
        `✅ Доход добавлен\n\n${buildLeadDetail(lead, 'owner').text}`,
      ]);
    });

    it('ignores a mid-job income answered after the lead was lost', async () => {
      seed(makeLead({ status: 'lost', pendingPrompt: awaiting('add_income') }));
      await answerPrompt('300');
      expect((await stored()).incomes).toEqual([]);
      expect(crm('editMessageText')).toEqual([]);
      expect(sentTo(ADMIN_ID)).toEqual([]);
    });

    it('rejects a zero mid-job income without recording anything', async () => {
      seed(makeLead({ pendingPrompt: awaiting('add_income') }));
      await answerPrompt('0');
      expect((await stored()).pendingPrompt).toEqual(awaiting('add_income'));
      expect(textsTo(DM_CHAT_ID)).toEqual([expect.stringContaining('сумма')]);
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

    it('postpones a lead that is still in negotiations and remembers the stage', async () => {
      seed(
        makeLead({
          status: 'negotiations',
          pendingPrompt: awaiting('postpone'),
        }),
      );
      await answerPrompt(LATER);
      expect(await stored()).toMatchObject({
        status: 'postponed',
        postponedFrom: 'negotiations',
      });
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
        status: 'in_progress',
        pendingPrompt: awaiting('postpone'),
      });
      expect(textsTo(DM_CHAT_ID)).toEqual([
        expect.stringContaining('ДД.ММ.ГГГГ'),
      ]);
    });

    it.each([
      ['a non-numeric reply', 'много'],
      ['a negative amount', '-500'],
      ['a zero amount', '0'],
      ['blank text', '   '],
    ])(
      'rejects %s as a deal amount without resolving the prompt',
      async (_label, text) => {
        seed(makeLead({ pendingPrompt: awaiting('deal_amount') }));
        await answerPrompt(text);
        expect(await stored()).toMatchObject({
          status: 'in_progress',
          pendingPrompt: awaiting('deal_amount'),
        });
        expect(textsTo(DM_CHAT_ID)).toEqual([expect.stringContaining('сумма')]);
      },
    );

    it('edit:name reply updates the field, refreshes the card, and confirms', async () => {
      seed(makeLead({ name: 'Old', pendingPrompt: awaiting('edit_name') }));
      await answerPrompt('Новое Имя');
      const lead = await stored();
      expect(lead.name).toBe('Новое Имя');
      expect(edits(CARD_CHAT_ID, CARD_MESSAGE_ID)).toHaveLength(1);
      expect(sentTo(DM_CHAT_ID)).toEqual([
        view({
          text: `✅ Обновлено\n\n${buildLeadDetail(lead, 'owner').text}`,
          reply_markup: buildLeadDetail(lead, 'owner').reply_markup,
        }),
      ]);
    });

    it('tells the admin what the field was and what it became', async () => {
      seed(
        makeLead({
          comment: 'Старый',
          pendingPrompt: awaiting('edit_comment'),
        }),
      );
      await answerPrompt('Перезвонить в среду');
      expect((await stored()).comment).toBe('Перезвонить в среду');
      expect(textsTo(ADMIN_ID)).toEqual([
        expect.stringMatching(/Старый[\s\S]*Перезвонить в среду/),
      ]);
    });

    it('rejects an empty edit value for name/contact', async () => {
      seed(makeLead({ pendingPrompt: awaiting('edit_name') }));
      await answerPrompt('   ');
      expect(await stored()).toMatchObject({
        name: 'Иван',
        pendingPrompt: awaiting('edit_name'),
      });
      expect(textsTo(DM_CHAT_ID)).toEqual([expect.stringContaining('пустым')]);
    });

    it('ignores a reply that matches no pending prompt', async () => {
      await message('random reply', OWNER_ID, { replyTo: 42 });
      expect(api.calls).toEqual([]);
    });

    it('reply correlation is attempted regardless of chat type (not gated behind private-only) — defense in depth', async () => {
      seed(
        makeLead({
          pendingPrompt: { chatId: -100999, messageId: 42, kind: 'edit_name' },
        }),
      );
      await message('Пётр', OWNER_ID, {
        chatId: -100999,
        type: 'group',
        replyTo: 42,
      });
      expect((await stored()).name).toBe('Пётр');
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

    it('denies plain DM text from an unknown user', async () => {
      await message('hi', OTHER_ID);
      expect(textsTo(OTHER_ID)).toEqual(['⛔ Доступ запрещён.']);
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
