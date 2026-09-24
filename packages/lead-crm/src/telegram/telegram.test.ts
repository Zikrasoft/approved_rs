import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  createTelegramClient,
  expectMessageAndChatId,
  expectMessageId,
} from './client.ts';
import { createFormatter } from './format.ts';
import { createNotifier } from './notify.ts';
import {
  LEAD_STATUSES,
  POSTPONABLE_STATUSES,
  withDerivedMoney,
} from '../schema.ts';
import type { LeadStatus, StoredLead } from '../schema.ts';

// Free functions — no per-business config, so they are imported directly.
import {
  statusLabel,
  isLeadStatusKey,
  buildStatusKeyboard,
  buildOwedList,
  formatDealsList,
  buildSearchResults,
  buildMenu,
  buildLeadList,
  buildStats,
  buildDeleteConfirm,
  buildRemindPicker,
  formatDateRu,
  leadDisplayName,
} from './format.ts';

const SERVICE_LABELS: Record<string, string> = {
  'vehicle-sourcing': 'Автоподбор',
};

const client = createTelegramClient('test-bot-token');
const formatter = createFormatter({
  serviceLabel: (slug) => SERVICE_LABELS[slug] ?? slug,
  botUsername: 'approved_test_bot',
});
const notifier = createNotifier({
  client,
  formatter,
  groupId: '-1009876543210',
  ownerIds: [111],
  adminIds: [222],
});

const { answerCallback, sendForceReplyPrompt } = client;
const { buildHelp, buildLeadDetail } = formatter;
const {
  sendLeadNotification,
  refreshLeadCard,
  sendDealNotificationToAdmin,
  sendIncomeNotificationToAdmin,
  sendCommissionClaimToAdmin,
  sendCommissionResultToOwner,
  sendQuarantinedLeadsToAdmin,
  sendStatusChangeToAdmin,
  sendFieldChangeToAdmin,
  sendPostponeReminderToOwner,
  editLeadDetailMessage,
} = notifier;

function makeLead(overrides: Partial<StoredLead> = {}): StoredLead {
  return withDerivedMoney({
    id: 42,
    brand: 'Approved.rs',
    name: 'Иван',
    contact: '@ivan',
    service: 'vehicle-sourcing',
    services: [],
    comment: 'BMW X5',
    country: 'de',
    source_url: '/ru/vehicle-sourcing/de/',
    locale: 'ru',
    status: 'new',
    dealAmount: null,
    commissionPercent: 10,
    paidAmount: 0,
    payments: [],
    telegramChatId: null,
    telegramMessageId: null,
    statusChangedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    pendingPrompt: null,
    archived: false,
    pendingCommissionClaim: null,
    remindAt: null,
    postponedFrom: null,
    incomes: [],
    ...overrides,
  });
}

// Intl.NumberFormat('ru-RU') uses a non-breaking thousands separator that
// isn't a plain U+0020 space — build expectations from the same formatter
// instead of hardcoding a literal that looks right but silently isn't.
function money(n: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(n)} €`;
}

function mockFetchOk(
  result: unknown = { message_id: 999, chat: { id: -1009876543210 } },
) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ result }),
  });
}

describe('sendLeadNotification', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('makes exactly 2 fetch calls (send + pin)', async () => {
    await sendLeadNotification(makeLead());
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('pins the sent message using the chat/message id from the send response', async () => {
    await sendLeadNotification(makeLead());
    const pinBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(mockFetch.mock.calls[1][0]).toContain('/pinChatMessage');
    expect(pinBody.chat_id).toBe(-1009876543210);
    expect(pinBody.message_id).toBe(999);
  });

  it('still returns the ids if pinning fails', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: { message_id: 999, chat: { id: -1009876543210 } },
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ description: 'Bad Request' }),
      });
    await expect(sendLeadNotification(makeLead())).resolves.toEqual({
      chatId: -1009876543210,
      messageId: 999,
    });
  });

  it('throws when the sendMessage response is missing message_id or chat.id', async () => {
    mockFetchOk({});
    await expect(sendLeadNotification(makeLead())).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sends only a minimal teaser — id, name, service, status — no contact/comment/PII', async () => {
    await sendLeadNotification(
      makeLead({ id: 42, comment: 'BMW X5', source_url: '/x/' }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-1009876543210');
    expect(body.text).toContain('#42');
    expect(body.text).toContain('Автоподбор');
    expect(body.text).toContain('Иван');
    expect(body.text).toContain('🆕 Новая');
    expect(body.text).not.toContain('@ivan');
    expect(body.text).not.toContain('BMW X5');
  });

  it('attaches exactly one deep-link url button, no callback_data, no status buttons', async () => {
    await sendLeadNotification(makeLead({ id: 42 }));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const kb = body.reply_markup.inline_keyboard;
    expect(kb).toHaveLength(1);
    expect(kb[0]).toHaveLength(1);
    expect(kb[0][0].callback_data).toBeUndefined();
    expect(kb[0][0].url).toBe('https://t.me/approved_test_bot?start=lead_42');
  });

  it('sends the message with parse_mode HTML', async () => {
    await sendLeadNotification(makeLead());
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.parse_mode).toBe('HTML');
  });

  it('throws when Telegram returns ok: false', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ description: 'Bad Request' }),
    });
    await expect(sendLeadNotification(makeLead())).rejects.toThrow();
  });
});

describe('leadDisplayName', () => {
  it('stands in for a lead left without a name', () => {
    expect(leadDisplayName(makeLead({ name: '' }))).toBe('—');
  });

  it('keeps the name a visitor did give', () => {
    expect(leadDisplayName(makeLead({ name: 'Иван' }))).toBe('Иван');
  });
});

describe('statusLabel', () => {
  it('returns "Новая" for the new status', () => {
    expect(statusLabel('new')).toBe('Новая');
  });

  it('maps known status keys to their Russian label', () => {
    expect(statusLabel('negotiations')).toBe('Переговоры');
    expect(statusLabel('in_progress')).toBe('В работе');
    expect(statusLabel('won')).toBe('Успешно');
    expect(statusLabel('lost')).toBe('Отказ');
  });

  it('falls back to the raw value for an unknown status (defensive, should not happen)', () => {
    expect(statusLabel('bogus' as unknown as LeadStatus)).toBe('bogus');
  });
});

describe('isLeadStatusKey', () => {
  it('is true only for the 4 known status keys', () => {
    expect(isLeadStatusKey('negotiations')).toBe(true);
    expect(isLeadStatusKey('in_progress')).toBe(true);
    expect(isLeadStatusKey('won')).toBe(true);
    expect(isLeadStatusKey('lost')).toBe(true);
  });

  it('is false for anything else, including "new"', () => {
    expect(isLeadStatusKey('new')).toBe(false);
    expect(isLeadStatusKey('bogus')).toBe(false);
    expect(isLeadStatusKey('')).toBe(false);
  });
});

describe('buildStatusKeyboard', () => {
  it('owner: shows Переговоры/Отказ for a new lead, with the lead id embedded in callback_data', () => {
    const kb = buildStatusKeyboard(makeLead({ id: 7, status: 'new' }), 'owner');
    expect(kb.inline_keyboard[0].map((b) => b.callback_data)).toEqual([
      'st:7:negotiations',
      'st:7:lost',
    ]);
  });

  it('owner: shows В работу/Отказ/Отложить for a lead in negotiations', () => {
    const kb = buildStatusKeyboard(
      makeLead({ id: 7, status: 'negotiations' }),
      'owner',
    );
    expect(kb.inline_keyboard.flat().map((b) => b.callback_data)).toEqual([
      'st:7:in_progress',
      'st:7:lost',
      'postpone:7',
    ]);
  });

  it('owner: shows Завершить/Отказ/Отложить for an in-progress lead', () => {
    const kb = buildStatusKeyboard(
      makeLead({ id: 7, status: 'in_progress' }),
      'owner',
    );
    expect(kb.inline_keyboard.flat().map((b) => b.callback_data)).toEqual([
      'st:7:won',
      'st:7:lost',
      'postpone:7',
    ]);
  });

  it('owner: has no buttons for a terminal (won/lost) lead', () => {
    expect(
      buildStatusKeyboard(makeLead({ status: 'won' }), 'owner').inline_keyboard,
    ).toEqual([]);
    expect(
      buildStatusKeyboard(makeLead({ status: 'lost' }), 'owner')
        .inline_keyboard,
    ).toEqual([]);
  });

  it('admin: only Переговоры for a new lead, no Отказ', () => {
    const kb = buildStatusKeyboard(makeLead({ id: 7, status: 'new' }), 'admin');
    expect(kb.inline_keyboard[0].map((b) => b.callback_data)).toEqual([
      'st:7:negotiations',
    ]);
  });

  it('admin: only В работу for a lead in negotiations, no Отказ or Отложить', () => {
    const kb = buildStatusKeyboard(
      makeLead({ id: 7, status: 'negotiations' }),
      'admin',
    );
    expect(kb.inline_keyboard.flat().map((b) => b.callback_data)).toEqual([
      'st:7:in_progress',
    ]);
  });

  it("admin: no buttons at all for an in-progress lead — can't finalize/postpone", () => {
    expect(
      buildStatusKeyboard(makeLead({ status: 'in_progress' }), 'admin')
        .inline_keyboard,
    ).toEqual([]);
  });

  it('offers Отложить to the owner on exactly the postponable statuses', () => {
    const withPostpone = LEAD_STATUSES.filter((status) =>
      buildStatusKeyboard(makeLead({ id: 7, status }), 'owner')
        .inline_keyboard.flat()
        .some((b) => b.callback_data === 'postpone:7'),
    );
    expect(withPostpone).toEqual([...POSTPONABLE_STATUSES]);
  });

  it('postponed: shows just Возобновить, for either role', () => {
    expect(
      buildStatusKeyboard(makeLead({ id: 7, status: 'postponed' }), 'owner')
        .inline_keyboard,
    ).toEqual([[{ text: '▶️ Возобновить', callback_data: 'resume:7' }]]);
    expect(
      buildStatusKeyboard(makeLead({ id: 7, status: 'postponed' }), 'admin')
        .inline_keyboard,
    ).toEqual([[{ text: '▶️ Возобновить', callback_data: 'resume:7' }]]);
  });
});

describe('refreshLeadCard', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('rebuilds the teaser and deep-link button from the current lead and edits the group message', async () => {
    const lead = makeLead({
      id: 42,
      status: 'won',
      telegramChatId: -1009876543210,
      telegramMessageId: 555,
    });
    await expect(refreshLeadCard(lead)).resolves.toBe(true);

    expect(mockFetch.mock.calls[0][0]).toContain('/editMessageText');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(-1009876543210);
    expect(body.message_id).toBe(555);
    expect(body.text).toContain('✅ Успешно');
    expect(body.reply_markup.inline_keyboard[0][0].url).toBe(
      'https://t.me/approved_test_bot?start=lead_42',
    );
  });

  it('reports no card when the lead has no Telegram message on file yet', async () => {
    await expect(
      refreshLeadCard(
        makeLead({ telegramChatId: null, telegramMessageId: null }),
      ),
    ).resolves.toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // TELEGRAM_GROUP_ID may be an @username (see docs/deploy.md), which never
  // equals the numeric chat.id Telegram reports back. Matching the two was
  // what stopped cards updating at all, so the edit goes by stored id alone.
  it('edits by the stored chat id without matching it against the configured group', async () => {
    await expect(
      refreshLeadCard(makeLead({ telegramChatId: -1, telegramMessageId: 1 })),
    ).resolves.toBe(true);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).chat_id).toBe(-1);
  });

  it.each([
    'Bad Request: message to edit not found',
    "Bad Request: message can't be edited",
  ])('reports no card when Telegram answers "%s"', async (description) => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ description }),
    });
    await expect(
      refreshLeadCard(
        makeLead({ telegramChatId: -1009876543210, telegramMessageId: 555 }),
      ),
    ).resolves.toBe(false);
  });

  it('resolves without throwing when Telegram rejects a no-op double-tap edit', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          description:
            'Bad Request: message is not modified: specified new message content and reply markup are exactly the same',
        }),
    });
    await expect(
      refreshLeadCard(
        makeLead({ telegramChatId: -1009876543210, telegramMessageId: 555 }),
      ),
    ).resolves.toBe(true);
  });

  it('still throws on a genuine editMessageText failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          description: 'Bad Request: chat not found',
        }),
    });
    await expect(
      refreshLeadCard(
        makeLead({ telegramChatId: -1009876543210, telegramMessageId: 555 }),
      ),
    ).rejects.toThrow();
  });
});

describe('sendForceReplyPrompt', () => {
  beforeEach(() => mockFetchOk({ message_id: 777 }));
  afterEach(() => mockFetch.mockReset());

  it('sends a force_reply prompt and returns its message_id', async () => {
    const id = await sendForceReplyPrompt(111, '💰 Укажи сумму сделки:');
    expect(id).toBe(777);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(111);
    expect(body.reply_markup).toEqual({ force_reply: true, selective: true });
  });
});

describe('sendFieldChangeToAdmin', () => {
  beforeEach(() => mockFetchOk({ message_id: 1 }));
  afterEach(() => mockFetch.mockReset());

  it('tells the admin what the value was and what it became', async () => {
    await sendFieldChangeToAdmin(
      makeLead({ id: 9, name: 'Иван Петров' }),
      'name',
      'Иван',
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(222);
    expect(body.text).toContain('#9');
    expect(body.text).toContain('имя');
    expect(body.text).toContain('Было: Иван');
    expect(body.text).toContain('Стало: Иван Петров');
  });

  it('goes to the admin, never to the owner', async () => {
    await sendFieldChangeToAdmin(
      makeLead({ comment: 'после' }),
      'comment',
      'до',
    );
    const recipients = mockFetch.mock.calls.map(
      (c) => JSON.parse(c[1].body).chat_id,
    );
    expect(recipients).toEqual([222]);
  });

  it('stays quiet when the value did not actually change', async () => {
    await sendFieldChangeToAdmin(
      makeLead({ comment: 'BMW X5' }),
      'comment',
      'BMW X5',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('treats a cleared field and an absent one as the same non-change', async () => {
    await sendFieldChangeToAdmin(makeLead({ comment: null }), 'comment', '');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('reports a field that had no value before', async () => {
    await sendFieldChangeToAdmin(
      makeLead({ comment: 'перезвонить в среду' }),
      'comment',
      undefined,
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('Было: —');
    expect(body.text).toContain('Стало: перезвонить в среду');
  });

  it('renders an emptied field as a dash rather than nothing', async () => {
    await sendFieldChangeToAdmin(
      makeLead({ comment: null }),
      'comment',
      'BMW X5',
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('Стало: —');
  });

  it('truncates a comment too long to read at a glance', async () => {
    const long = 'а'.repeat(200);
    await sendFieldChangeToAdmin(
      makeLead({ comment: long }),
      'comment',
      'коротко',
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('…');
    expect(body.text).not.toContain(long);
  });

  it('escapes html so a contact with angle brackets cannot break the message', async () => {
    await sendFieldChangeToAdmin(
      makeLead({ contact: '<b>ivan</b>' }),
      'contact',
      '@ivan',
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('&lt;b&gt;ivan&lt;/b&gt;');
  });
});

describe('sendDealNotificationToAdmin', () => {
  beforeEach(() => mockFetchOk({ message_id: 1 }));
  afterEach(() => mockFetch.mockReset());

  it('computes commission from commissionPercent — informational only, no button', async () => {
    await sendDealNotificationToAdmin(
      makeLead({ id: 9, dealAmount: 100000, commissionPercent: 10 }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(222);
    expect(body.text).toContain(`Твоя комиссия (10%): ${money(10000)}`);
    expect(body.reply_markup).toBeUndefined();
  });

  it('does nothing when the deal has no amount yet', async () => {
    await sendDealNotificationToAdmin(makeLead({ dealAmount: null }));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('sendIncomeNotificationToAdmin', () => {
  beforeEach(() => mockFetchOk({ message_id: 1 }));
  afterEach(() => mockFetch.mockReset());

  it('tells the admin what came in mid-job and the commission on it', async () => {
    const lead = makeLead({
      id: 9,
      status: 'in_progress',
      incomes: [
        { id: 1, amount: 300, at: '2026-03-01T00:00:00.000Z', paidAt: null },
      ],
    });

    await sendIncomeNotificationToAdmin(lead, lead.incomes[0]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.chat_id).toBe(222);
    expect(body.text).toContain(money(300));
    expect(body.text).toContain(`(10%): ${money(30)}`);
  });
});

describe('sendCommissionClaimToAdmin', () => {
  beforeEach(() => mockFetchOk({ message_id: 1 }));
  afterEach(() => mockFetch.mockReset());

  it('notifies the admin with confirm/reject buttons for the claimed amount', async () => {
    await sendCommissionClaimToAdmin(
      makeLead({
        id: 9,
        pendingCommissionClaim: {
          amount: 4000,
          claimedAt: '2026-01-01T00:00:00.000Z',
          incomeIds: [1],
        },
      }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(222);
    expect(body.text).toContain(money(4000));
    const buttons = body.reply_markup.inline_keyboard[0];
    expect(
      buttons.map((b: { callback_data: string }) => b.callback_data),
    ).toEqual(['confirmpay:9', 'rejectpay:9']);
  });

  it('does nothing without a pending claim', async () => {
    await sendCommissionClaimToAdmin(
      makeLead({ pendingCommissionClaim: null }),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('sendCommissionResultToOwner', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('tells the owner the payment was confirmed', async () => {
    await sendCommissionResultToOwner(makeLead({ id: 9 }), true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(111);
    expect(body.text).toContain('подтверждена');
  });

  it('tells the owner the payment was rejected', async () => {
    await sendCommissionResultToOwner(makeLead({ id: 9 }), false);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('не подтверждена');
  });
});

describe('sendPostponeReminderToOwner', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('sends the reminder to the owner with a deep-link button', async () => {
    await sendPostponeReminderToOwner(makeLead({ id: 9 }));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(111);
    expect(body.reply_markup.inline_keyboard[0][0].url).toContain('lead_9');
  });

  // Only one OWNER_ID in this test env, so "every send failed" and "the
  // only send failed" are the same case here — still the behavior that
  // matters: don't silently succeed when nobody actually got the reminder,
  // so the cron's catch block keeps the lead 'due' for a retry.
  it('throws when every owner send fails, so the cron keeps the lead due for retry', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ description: 'Bad Request' }),
    });
    await expect(
      sendPostponeReminderToOwner(makeLead({ id: 9 })),
    ).rejects.toThrow();
  });
});

describe('sendStatusChangeToAdmin', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it("notifies every admin id with the lead's current status", async () => {
    await sendStatusChangeToAdmin(
      makeLead({ id: 9, name: 'Пётр', status: 'in_progress' }),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(222);
    expect(body.text).toContain('#9');
    expect(body.text).toContain('Пётр');
    expect(body.text).toContain('🔵 В работе');
  });
});

describe('sendQuarantinedLeadsToAdmin', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('tells every admin how many were copied, by whom and where', async () => {
    await sendQuarantinedLeadsToAdmin(
      3,
      'data/leads-unreadable.json',
      'CarLab',
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(222);
    expect(body.text).toBe(
      [
        '⚠️ Нечитаемых заявок: 3',
        '',
        'Нашёл сайт CarLab и скопировал в data/leads-unreadable.json.',
        'Из data/leads.json ничего не убирал — удалить можно только руками.',
      ].join('\n'),
    );
  });

  it('escapes a path that carries markup', async () => {
    await sendQuarantinedLeadsToAdmin(1, '<b>x</b>.json', '<i>Brand</i>');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('&lt;b&gt;');
    expect(body.text).toContain('&lt;i&gt;');
  });
});

describe('buildOwedList', () => {
  it('renders each row as a tappable button opening that lead, plus a total', () => {
    const { text, reply_markup } = buildOwedList(
      [
        {
          id: 1,
          name: 'Иван',
          brand: 'Approved.rs',
          dealAmount: 100000,
          commissionAmount: 10000,
          paidAmount: 0,
          remaining: 10000,
        },
      ],
      10000,
    );
    expect(text).toContain(`Итого: ${money(10000)}`);
    expect(reply_markup.inline_keyboard).toEqual([
      [
        {
          text: `#1 Иван · Approved.rs — ${money(10000)}`,
          callback_data: 'open:1',
        },
      ],
    ]);
  });

  it('reports no debt when there are no rows, with no buttons', () => {
    const { text, reply_markup } = buildOwedList([], 0);
    expect(text).toBe(
      '<b>🔴 Долг по комиссии</b>\n\n🟢 Всё оплачено, долгов нет.',
    );
    expect(reply_markup.inline_keyboard).toEqual([]);
  });
});

describe('formatDealsList', () => {
  it('marks an unpaid deal 🔴', () => {
    const text = formatDealsList([
      makeLead({ id: 1, status: 'won', dealAmount: 100000, paidAmount: 0 }),
    ]);
    expect(text).toContain('🔴 Не оплачено');
  });

  it('marks a deal with one income settled and one still owed 🟡', () => {
    const text = formatDealsList([
      makeLead({
        id: 1,
        status: 'won',
        incomes: [
          { id: 1, amount: 70000, at: 'x', paidAt: 'y' },
          { id: 2, amount: 30000, at: 'x', paidAt: null },
        ],
      }),
    ]);
    expect(text).toContain(`🟡 Оплачено ${money(7000)} из ${money(10000)}`);
  });

  it('marks a fully-paid deal 🟢', () => {
    const text = formatDealsList([
      makeLead({ id: 1, status: 'won', dealAmount: 100000, paidAmount: 10000 }),
    ]);
    expect(text).toContain('🟢 Оплачено');
  });

  it('excludes archived deals', () => {
    const text = formatDealsList([
      makeLead({ id: 1, status: 'won', dealAmount: 100000, archived: true }),
    ]);
    expect(text).toBe('<b>💰 Все сделки</b>\n\nСделок пока нет.');
  });

  it('reports nothing when there are no deals, with the same bold header as the non-empty case', () => {
    expect(formatDealsList([])).toBe(
      '<b>💰 Все сделки</b>\n\nСделок пока нет.',
    );
  });

  it('caps at 20 deals, newest first', () => {
    const leads = Array.from({ length: 25 }, (_, i) =>
      makeLead({ id: i + 1, status: 'won', dealAmount: 10000 }),
    );
    const text = formatDealsList(leads);
    const shown = [...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
    expect(shown).toHaveLength(20);
    expect(shown[0]).toBe(25);
  });
});

describe('buildSearchResults', () => {
  it('renders each match as a tappable button: status emoji, id, name, contact', () => {
    const { reply_markup } = buildSearchResults([
      makeLead({
        id: 5,
        name: 'Пётр',
        contact: '@petr',
        status: 'in_progress',
      }),
    ]);
    expect(reply_markup.inline_keyboard).toEqual([
      [{ text: '🔵 #5 Approved.rs Пётр — @petr', callback_data: 'open:5' }],
    ]);
  });

  it('prefixes an archived match with 🗄', () => {
    const { reply_markup } = buildSearchResults([
      makeLead({ id: 5, name: 'Пётр', contact: '@petr', archived: true }),
    ]);
    expect(reply_markup.inline_keyboard[0][0].text).toBe(
      '🗄 🆕 #5 Approved.rs Пётр — @petr',
    );
  });

  it('reports nothing found for an empty list, no buttons', () => {
    const { text, reply_markup } = buildSearchResults([]);
    expect(text).toBe('Ничего не найдено.');
    expect(reply_markup.inline_keyboard).toEqual([]);
  });
});

describe('buildMenu', () => {
  it('gives the owner lead lists + stats + their own commission debt, no full deals ledger', () => {
    const menu = buildMenu('owner');
    const data = menu.reply_markup.inline_keyboard
      .flat()
      .map((b) => b.callback_data);
    expect(data).toEqual([
      'list:new',
      'list:negotiations',
      'list:in_progress+postponed',
      'list:won',
      'list:lost',
      'menu:stats',
      'menu:debt',
    ]);
    const debtBtn = menu.reply_markup.inline_keyboard
      .flat()
      .find((b) => b.callback_data === 'menu:debt');
    expect(debtBtn?.text).toBe('🔴 Мой долг по комиссии');
  });

  it('gives the admin the same lists plus debt (admin-framed label) and the full deals ledger', () => {
    const menu = buildMenu('admin');
    const data = menu.reply_markup.inline_keyboard
      .flat()
      .map((b) => b.callback_data);
    expect(data).toEqual([
      'list:new',
      'list:negotiations',
      'list:in_progress+postponed',
      'list:won',
      'list:lost',
      'menu:stats',
      'menu:debt',
      'menu:deals',
    ]);
    const debtBtn = menu.reply_markup.inline_keyboard
      .flat()
      .find((b) => b.callback_data === 'menu:debt');
    expect(debtBtn?.text).toBe('🔴 Мне должны');
  });
});

describe('buildHelp', () => {
  it('owner text explains adding incomes, finalizing and the per-income claim', () => {
    const text = buildHelp('owner');
    expect(text).toContain('Завершить');
    expect(text).toContain('Добавить доход');
    expect(text).toContain('Оплатил всё');
    expect(text).not.toContain('Подтвердить');
  });

  it('admin text explains they cannot finalize and must confirm/reject claims', () => {
    const text = buildHelp('admin');
    expect(text).toContain('только владелец');
    expect(text).toContain('Подтвердить');
    expect(text).toContain('Все сделки');
  });
});

describe('buildLeadList', () => {
  it('lists open buttons for leads in the given status, excluding archived, newest first', () => {
    const leads = [
      makeLead({ id: 1, status: 'new' }),
      makeLead({ id: 2, status: 'new', archived: true }),
      makeLead({ id: 3, status: 'new' }),
      makeLead({ id: 4, status: 'won' }),
    ];
    const list = buildLeadList(leads, 'new');
    const data = list.reply_markup.inline_keyboard.map(
      (row) => row[0].callback_data,
    );
    expect(data).toEqual(['open:3', 'open:1']);
  });

  it('reports an empty bucket', () => {
    expect(buildLeadList([], 'new').text).toBe('Пусто.');
  });

  it('accepts multiple statuses and merges them into one list', () => {
    const leads = [
      makeLead({ id: 1, status: 'in_progress' }),
      makeLead({ id: 2, status: 'postponed' }),
      makeLead({ id: 3, status: 'won' }),
    ];
    const list = buildLeadList(leads, ['in_progress', 'postponed']);
    const data = list.reply_markup.inline_keyboard.map(
      (row) => row[0].callback_data,
    );
    expect(data).toEqual(['open:2', 'open:1']);
  });
});

describe('buildStats', () => {
  const leads = [
    makeLead({ id: 1, status: 'new' }),
    makeLead({ id: 2, status: 'in_progress' }),
    makeLead({
      id: 3,
      status: 'won',
      incomes: [
        { id: 1, amount: 40000, at: 'x', paidAt: 'y' },
        { id: 2, amount: 60000, at: 'x', paidAt: null },
      ],
    }),
    makeLead({ id: 4, status: 'lost' }),
    makeLead({ id: 5, status: 'new', archived: true }),
  ];

  it('admin: counts by status and sums money across won leads, excluding archived', () => {
    const text = buildStats(leads, 'admin');
    expect(text).toContain('Всего заявок: 4 (+1 в архиве)');
    expect(text).toContain(`💰 Заработано (доход владельца): ${money(100000)}`);
    expect(text).toContain(`Комиссия начислена: ${money(10000)}`);
    expect(text).toContain(`Оплачено: ${money(4000)}`);
    expect(text).toContain(`🔴 Осталось получить: ${money(6000)}`);
  });

  it('owner: same totals, worded from the owner\'s side (what he still owes, not "receives")', () => {
    const text = buildStats(leads, 'owner');
    expect(text).toContain(`💰 Заработано: ${money(100000)}`);
    expect(text).toContain(`Комиссия к оплате: ${money(10000)}`);
    expect(text).toContain(`Оплачено: ${money(4000)}`);
    expect(text).toContain(`🔴 Осталось оплатить: ${money(6000)}`);
    expect(text).not.toContain('доход владельца');
    expect(text).not.toContain('Осталось получить');
  });
});

describe('buildLeadDetail', () => {
  it('new lead: status buttons + edit row + archive row, no money row', () => {
    const { text, reply_markup } = buildLeadDetail(
      makeLead({ id: 7, status: 'new' }),
      'owner',
    );
    expect(text).toContain('#7');
    expect(text).not.toContain('Комиссия Zikrasoft');
    const rows = reply_markup.inline_keyboard;
    expect(rows[0].map((b) => b.callback_data)).toEqual([
      'st:7:negotiations',
      'st:7:lost',
    ]);
    expect(rows[1].map((b) => b.callback_data)).toEqual([
      'edit:7:name',
      'edit:7:contact',
      'edit:7:comment',
    ]);
    expect(rows[rows.length - 1]).toEqual([
      { text: '🗑 Архивировать', callback_data: 'arch:7' },
    ]);
  });

  it('in_progress lead: Завершить/Отказ status row', () => {
    const { reply_markup } = buildLeadDetail(
      makeLead({ id: 7, status: 'in_progress' }),
      'owner',
    );
    expect(reply_markup.inline_keyboard[0].map((b) => b.callback_data)).toEqual(
      ['st:7:won', 'st:7:lost'],
    );
  });

  it('won lead, owner, no claim pending: a claim button', () => {
    const lead = makeLead({
      id: 7,
      status: 'won',
      dealAmount: 100000,
      paidAmount: 0,
    });
    const { text, reply_markup } = buildLeadDetail(lead, 'owner');
    expect(text).toContain('Осталось:');
    const data = reply_markup.inline_keyboard
      .flat()
      .map((b) => b.callback_data);
    expect(data).toContain('claimpay:7:1');
    expect(
      reply_markup.inline_keyboard[0].some((b) =>
        b.callback_data?.startsWith('st:'),
      ),
    ).toBe(false);
  });

  it('lists every income with its own commission and paid mark', () => {
    const lead = makeLead({
      id: 7,
      status: 'won',
      incomes: [
        { id: 1, amount: 300, at: '2026-03-01T00:00:00.000Z', paidAt: 'y' },
        { id: 2, amount: 200, at: '2026-03-05T00:00:00.000Z', paidAt: null },
      ],
    });

    const { text, reply_markup } = buildLeadDetail(lead, 'owner');

    expect(text).toContain(
      `• ${money(300)} от 01.03.2026 · комиссия ${money(30)} · 🟢 оплачена`,
    );
    expect(text).toContain(
      `• ${money(200)} от 05.03.2026 · комиссия ${money(20)} · 🔴 не оплачена`,
    );
    expect(
      reply_markup.inline_keyboard.flat().map((b) => b.callback_data),
    ).toContain('claimpay:7:2');
  });

  it('offers a pay-everything button only when more than one income is owed', () => {
    const one = buildLeadDetail(
      makeLead({
        id: 7,
        status: 'won',
        incomes: [
          { id: 1, amount: 300, at: '2026-03-01T00:00:00.000Z', paidAt: null },
        ],
      }),
      'owner',
    );
    const two = buildLeadDetail(
      makeLead({
        id: 7,
        status: 'won',
        incomes: [
          { id: 1, amount: 300, at: '2026-03-01T00:00:00.000Z', paidAt: null },
          { id: 2, amount: 200, at: '2026-03-05T00:00:00.000Z', paidAt: null },
        ],
      }),
      'owner',
    );

    expect(
      one.reply_markup.inline_keyboard.flat().map((b) => b.callback_data),
    ).not.toContain('claimpay:7');
    const rows = two.reply_markup.inline_keyboard.flat();
    expect(rows.map((b) => b.callback_data)).toContain('claimpay:7');
    expect(rows.find((b) => b.callback_data === 'claimpay:7')?.text).toBe(
      `💸 Оплатил всё — ${money(50)}`,
    );
  });

  it('lets the owner add an income while the job is still running, but not the admin', () => {
    const lead = makeLead({ id: 7, status: 'in_progress' });

    expect(
      buildLeadDetail(lead, 'owner')
        .reply_markup.inline_keyboard.flat()
        .map((b) => b.callback_data),
    ).toContain('income:7');
    expect(
      buildLeadDetail(lead, 'admin')
        .reply_markup.inline_keyboard.flat()
        .map((b) => b.callback_data),
    ).not.toContain('income:7');
  });

  it('keeps the add-income button off a lead nobody is working on', () => {
    for (const status of ['new', 'lost'] as const) {
      const { reply_markup } = buildLeadDetail(
        makeLead({ id: 7, status }),
        'owner',
      );
      expect(
        reply_markup.inline_keyboard.flat().map((b) => b.callback_data),
      ).not.toContain('income:7');
    }
  });

  it('shows the commission block without an income list for a legacy zero-euro deal', () => {
    const { text } = buildLeadDetail(
      makeLead({ id: 7, status: 'won', dealAmount: 0 }),
      'owner',
    );

    expect(text).toContain(`💰 Комиссия Zikrasoft: ${money(0)}`);
    expect(text).not.toContain('💶 Доходы:');
  });

  it('won lead, owner, claim pending: shows waiting line, no claim button', () => {
    const lead = makeLead({
      id: 7,
      status: 'won',
      dealAmount: 100000,
      pendingCommissionClaim: {
        amount: 3000,
        claimedAt: '2026-01-01T00:00:00.000Z',
        incomeIds: [1],
      },
    });
    const { text, reply_markup } = buildLeadDetail(lead, 'owner');
    expect(text).toContain(`🕓 Ожидает подтверждения: ${money(3000)}`);
    expect(
      reply_markup.inline_keyboard
        .flat()
        .some((b) => b.callback_data?.startsWith('claimpay:')),
    ).toBe(false);
  });

  it('won lead, admin, no remaining and no pending claim: no money buttons at all', () => {
    const lead = makeLead({
      id: 7,
      status: 'won',
      dealAmount: 100000,
      paidAmount: 10000,
    });
    const { reply_markup } = buildLeadDetail(lead, 'admin');
    const data = reply_markup.inline_keyboard
      .flat()
      .map((b) => b.callback_data);
    expect(data).not.toContain('confirmpay:7');
    expect(data).not.toContain('rejectpay:7');
  });

  it('won lead, admin, claim pending: shows confirm/reject', () => {
    const lead = makeLead({
      id: 7,
      status: 'won',
      dealAmount: 100000,
      pendingCommissionClaim: {
        amount: 3000,
        claimedAt: '2026-01-01T00:00:00.000Z',
        incomeIds: [1],
      },
    });
    const { reply_markup } = buildLeadDetail(lead, 'admin');
    const data = reply_markup.inline_keyboard
      .flat()
      .map((b) => b.callback_data);
    expect(data).toEqual(
      expect.arrayContaining(['confirmpay:7', 'rejectpay:7']),
    );
  });

  it('deal-amount line is worded per role — owner sees "твой", admin sees "владельца"', () => {
    const lead = makeLead({
      id: 7,
      status: 'won',
      dealAmount: 100000,
      paidAmount: 0,
    });
    expect(buildLeadDetail(lead, 'owner').text).toContain(
      `💰 Твой доход с заявки: ${money(100000)}`,
    );
    expect(buildLeadDetail(lead, 'admin').text).toContain(
      `💰 Доход владельца с заявки: ${money(100000)}`,
    );
  });

  it('lost lead: no money row regardless of role', () => {
    const { text } = buildLeadDetail(
      makeLead({ id: 7, status: 'lost' }),
      'admin',
    );
    expect(text).not.toContain('Комиссия Zikrasoft');
  });

  it('archived lead, owner: only a restore button, no delete', () => {
    const { text, reply_markup } = buildLeadDetail(
      makeLead({ id: 7, status: 'won', dealAmount: 100000, archived: true }),
      'owner',
    );
    expect(text).toContain('🗄 В архиве');
    expect(reply_markup.inline_keyboard).toEqual([
      [{ text: '♻️ Восстановить', callback_data: 'unarch:7' }],
    ]);
  });

  it('archived lead, admin: restore button plus permanent delete', () => {
    const { reply_markup } = buildLeadDetail(
      makeLead({ id: 7, status: 'won', dealAmount: 100000, archived: true }),
      'admin',
    );
    const data = reply_markup.inline_keyboard
      .flat()
      .map((b) => b.callback_data);
    expect(data).toEqual(['unarch:7', 'del:7']);
  });

  it('active lead: admin gets a permanent-delete row, owner does not', () => {
    const lead = makeLead({ id: 7, status: 'new' });
    const ownerData = buildLeadDetail(lead, 'owner')
      .reply_markup.inline_keyboard.flat()
      .map((b) => b.callback_data);
    const adminData = buildLeadDetail(lead, 'admin')
      .reply_markup.inline_keyboard.flat()
      .map((b) => b.callback_data);
    expect(ownerData).not.toContain('del:7');
    expect(adminData).toContain('del:7');
  });

  it('reuses the full card body — name/contact/comment/deal amount present', () => {
    const { text } = buildLeadDetail(
      makeLead({
        id: 7,
        dealAmount: 50000,
        comment: 'BMW X5',
        contactChannel: 'whatsapp',
      }),
      'owner',
    );
    expect(text).toContain('Иван');
    expect(text).toContain('@ivan (WhatsApp)');
    expect(text).toContain('BMW X5');
    expect(text).toContain(money(50000));
  });
});

describe('buildDeleteConfirm', () => {
  it('asks for confirmation with confirm/cancel buttons scoped to the lead id', () => {
    const { text, reply_markup } = buildDeleteConfirm(
      makeLead({ id: 9, name: 'Test' }),
    );
    expect(text).toContain('#9');
    expect(text).toContain('Test');
    expect(reply_markup.inline_keyboard).toEqual([
      [
        { text: '✅ Да, удалить', callback_data: 'delconfirm:9' },
        { text: '↩️ Отмена', callback_data: 'delcancel:9' },
      ],
    ]);
  });
});

describe('buildRemindPicker', () => {
  it('offers quick presets, manual entry, and a way back — all scoped to the lead id', () => {
    const { reply_markup } = buildRemindPicker(9);
    const data = reply_markup.inline_keyboard
      .flat()
      .map((b) => b.callback_data);
    expect(data).toEqual([
      'remindpick:9:1',
      'remindpick:9:3',
      'remindpick:9:7',
      'remindpick:9:14',
      'remindpick:9:30',
      'remindtype:9',
      'remindcancel:9',
    ]);
  });
});

describe('editLeadDetailMessage', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('edits the given message with the role-appropriate detail view', async () => {
    await editLeadDetailMessage(111, 555, makeLead({ id: 7 }), 'owner');
    expect(mockFetch.mock.calls[0][0]).toContain('/editMessageText');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(111);
    expect(body.message_id).toBe(555);
  });
});

describe('answerCallback', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('posts to answerCallbackQuery with the callback id and optional text', async () => {
    await answerCallback('cb-1', 'Статус обновлён');
    expect(mockFetch.mock.calls[0][0]).toContain('/answerCallbackQuery');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      callback_query_id: 'cb-1',
      text: 'Статус обновлён',
    });
  });
});

describe('formatDateRu', () => {
  it('renders a stored ISO date the way the owner types it', () => {
    expect(formatDateRu('2026-03-09')).toBe('09.03.2026');
  });
});

describe('expectMessageId', () => {
  it('names the context when Telegram answers without a message_id', () => {
    expect(() => expectMessageId({}, 'force-reply prompt')).toThrow(
      'force-reply prompt response missing message_id',
    );
  });

  it('names the context when Telegram answers without a chat id', () => {
    expect(() =>
      expectMessageAndChatId({ message_id: 1 }, 'sendMessage'),
    ).toThrow('sendMessage response missing chat.id');
  });
});

describe('tgPost error reporting', () => {
  it('falls back to bare status when Telegram sends no description', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(client.tgPost('sendMessage', {})).rejects.toThrow(
      'Telegram sendMessage failed: 500',
    );
  });
});

describe('per-business formatter config', () => {
  const detailingFormatter = createFormatter({
    serviceLabel: () => 'Оклейка плёнкой',
    botUsername: 'detailing_bot',
  });

  it('does not quote one business rate in help text a shared bot shows every brand', () => {
    expect(detailingFormatter.buildHelp('owner')).not.toMatch(
      /\d+% от прибыли/,
    );
  });

  it('computes the money line from the rate stored on the lead', () => {
    const lead = makeLead({
      status: 'won',
      dealAmount: 1000,
      commissionPercent: 50,
    });

    expect(detailingFormatter.buildLeadDetail(lead, 'owner').text).toContain(
      '500',
    );
  });

  it('builds its deep link from its own bot username', () => {
    expect(
      detailingFormatter.deepLinkKeyboard(7).inline_keyboard[0][0].url,
    ).toBe('https://t.me/detailing_bot?start=lead_7');
  });

  it('renders its own service label', () => {
    expect(detailingFormatter.formatTeaser(makeLead())).toContain(
      'Оклейка плёнкой',
    );
  });
});

describe('a lead that asked for several services at once', () => {
  const multi = makeLead({
    service: 'vehicle-sourcing',
    services: ['vehicle-sourcing', 'vehicle-inspection'],
    status: 'postponed',
    remindAt: '2026-02-01T00:00:00.000Z',
  });

  it('names every service on the lead card', () => {
    expect(buildLeadDetail(multi, 'owner').text).toContain(
      'Автоподбор · vehicle-inspection',
    );
  });

  it('names every service in the teaser', () => {
    expect(formatter.formatTeaser(multi)).toContain(
      'Автоподбор · vehicle-inspection',
    );
  });

  it('names every service in the postpone reminder', () => {
    expect(formatter.postponeReminderText(multi)).toContain(
      'Автоподбор · vehicle-inspection',
    );
  });

  it('falls back to the single stored service for a lead saved before multi-select', () => {
    expect(formatter.formatTeaser(makeLead({ services: [] }))).toContain(
      'Автоподбор',
    );
  });

  it('shows the channel a contact click came from, in place of a service', () => {
    const click = makeLead({
      contact: '—',
      service: '',
      services: [],
      kind: 'call_click',
      contactChannel: 'telegram',
    });
    expect(buildLeadDetail(click, 'owner').text).toContain('Клик: Telegram');
  });

  it('stops calling a click a click once a form left a real contact on it', () => {
    const upgraded = makeLead({
      contact: '@ivan',
      service: '',
      services: [],
      kind: 'call_click',
      contactChannel: 'telegram',
    });
    expect(buildLeadDetail(upgraded, 'owner').text).toContain('Заявка #42 — —');
  });

  it('marks a click whose channel never reached the record', () => {
    const click = makeLead({
      contact: '—',
      service: '',
      services: [],
      kind: 'call_click',
      contactChannel: null,
    });
    expect(formatter.formatTeaser(click)).toContain('· — ·');
  });

  it('prints a channel it has no label for as it is stored', () => {
    const click = makeLead({
      contact: '—',
      service: '',
      services: [],
      kind: 'call_click',
      contactChannel: 'signal',
    });
    expect(formatter.formatTeaser(click)).toContain('Клик: signal');
  });

  it('marks a lead that named no service instead of leaving a gap', () => {
    const serviceless = makeLead({ service: '', services: [] });
    expect(buildLeadDetail(serviceless, 'owner').text).toContain(
      'Заявка #42 — —',
    );
    expect(formatter.formatTeaser(serviceless)).toContain('· — ·');
  });

  it('keeps the card inside the Telegram length limit when the services are flooded', () => {
    const flooded = makeLead({
      services: Array.from({ length: 20 }, () => 'x'.repeat(200)),
    });
    expect(buildLeadDetail(flooded, 'owner').text.length).toBeLessThan(1000);
    expect(formatter.formatTeaser(flooded).length).toBeLessThan(1000);
    expect(formatter.postponeReminderText(flooded).length).toBeLessThan(1000);
  });
});

describe('brand attribution — one bot, one chat, several businesses', () => {
  it('names the brand on the lead card, so the owner knows which business the lead is for', () => {
    const text = buildLeadDetail(makeLead({ brand: 'PRIZMA' }), 'owner').text;
    expect(text).toContain('🏷 PRIZMA');
  });

  it('escapes a brand name containing HTML rather than injecting it into the card', () => {
    const text = buildLeadDetail(
      makeLead({ brand: '<b>oops</b>' }),
      'owner',
    ).text;
    expect(text).toContain('&lt;b&gt;oops&lt;/b&gt;');
    expect(text).not.toContain('<b>oops</b>');
  });

  it('names the brand on every triage list row', () => {
    const { reply_markup } = buildLeadList(
      [makeLead({ id: 3, name: 'Petar', brand: 'AutoHub' })],
      'new',
    );
    expect(reply_markup.inline_keyboard[0][0].text).toContain('AutoHub');
  });

  it('names the brand on every deal line', () => {
    const text = formatDealsList([
      makeLead({ status: 'won', dealAmount: 1000, brand: 'PRIZMA' }),
    ]);
    expect(text).toContain('PRIZMA');
  });

  it('breaks the stats down per brand once more than one business has leads', () => {
    const text = buildStats(
      [
        makeLead({ id: 1, brand: 'Approved.rs' }),
        makeLead({ id: 2, brand: 'PRIZMA' }),
        makeLead({ id: 3, brand: 'PRIZMA' }),
      ],
      'owner',
    );
    expect(text).toContain('По брендам: Approved.rs — 1 · PRIZMA — 2');
  });

  it('omits the per-brand breakdown for a single-business store', () => {
    const text = buildStats([makeLead({ brand: 'Approved.rs' })], 'owner');
    expect(text).not.toContain('По брендам');
  });

  it('counts only active leads in the per-brand breakdown', () => {
    const text = buildStats(
      [
        makeLead({ id: 1, brand: 'Approved.rs' }),
        makeLead({ id: 2, brand: 'PRIZMA' }),
        makeLead({ id: 3, brand: 'PRIZMA', archived: true }),
      ],
      'owner',
    );
    expect(text).toContain('По брендам: Approved.rs — 1 · PRIZMA — 1');
  });
});
