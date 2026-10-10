import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { recordBotApi } from '../testing/botApi.ts';
import { createTelegramClient } from './client.ts';
import { createFormatter } from './format.ts';
import { createNotifier } from './notify.ts';
import { LEAD_STATUSES } from '../schema.ts';
import type { StoredLead } from '../schema.ts';
import type { LedgerOperation } from '../ledgerStore.ts';

import {
  REFERRAL_NOTE,
  buildSearchResults,
  buildMenu,
  buildBalance,
  LEDGER_COPY,
  operationNoticeText,
  operationRecordedText,
  operationRefusedText,
  reAskOperationText,
  buildOpenList,
  buildStats,
  buildDeleteConfirm,
  buildRemindPicker,
  formatDateRu,
  leadDisplayName,
} from './format.ts';

const SERVICE_LABELS: Record<string, string> = {
  'vehicle-sourcing': 'Автоподбор',
};

const client = createTelegramClient('test-bot-token', 'test_bot');
const formatter = createFormatter({
  serviceLabel: (slug) => SERVICE_LABELS[slug] ?? slug,
  botUsername: 'approved_test_bot',
  replyRelayBrands: ['Approved.rs', 'Details'],
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
  unpinLeadCard,
  sendOperationNotice,
  sendQuarantinedLeadsToAdmin,
  sendStatusChangeToAdmin,
  sendFieldChangeToAdmin,
  sendDigest,
  editLeadDetailMessage,
} = notifier;

function makeLead(overrides: Partial<StoredLead> = {}): StoredLead {
  return {
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
    status: 'open',
    telegramChatId: null,
    telegramMessageId: null,
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

function money(n: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(n)} €`;
}

const api = recordBotApi();

function mockFetchOk(
  result: unknown = { message_id: 999, chat: { id: -1009876543210 } },
) {
  api.reset();
  api.respond('sendMessage', result);
  mockFetch.mockImplementation(api.fetch);
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
    api.fail('pinChatMessage', 'Bad Request');
    await expect(sendLeadNotification(makeLead())).resolves.toEqual({
      chatId: -1009876543210,
      messageId: 999,
    });
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
    expect(body.text).toContain('🔵 Открыта');
    expect(body.text).toContain(`🏷 ${makeLead().brand}`);
    expect(body.text).not.toContain('@ivan');
    expect(body.text).not.toContain('BMW X5');
  });

  it('says in the teaser that the lead came through the capture bot', async () => {
    await sendLeadNotification(makeLead({ telegramId: 77 }));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('🤖 через бота');
  });

  it('says in the teaser that the Approved bot referred the lead', async () => {
    await sendLeadNotification(
      makeLead({ telegramId: 77, referredBy: 'approved' }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('🤖 через бота · 🤝 из бота Approved.rs');
  });

  it('ignores a comment that only quotes the referral note', async () => {
    await sendLeadNotification(
      makeLead({ telegramId: 77, comment: `Сообщение: ${REFERRAL_NOTE}` }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).not.toContain('🤝');
  });

  it('leaves the bot mark off a lead the site wrote', async () => {
    await sendLeadNotification(makeLead());
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).not.toContain('через бота');
  });

  it('attaches the deep link and the three outcome buttons', async () => {
    await sendLeadNotification(makeLead({ id: 42 }));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.reply_markup.inline_keyboard).toEqual([
      [
        {
          text: '📂 Открыть в боте',
          url: 'https://t.me/approved_test_bot?start=lead_42',
        },
      ],
      [
        { text: '✅ Сделка', callback_data: 'won:42' },
        { text: '❌ Отказ', callback_data: 'lost:42' },
        { text: '⏳ В работе', callback_data: 'work:42' },
      ],
    ]);
  });

  it.each(['won', 'lost'] as const)(
    'posts a %s lead unpinned',
    async (status) => {
      await sendLeadNotification(makeLead({ status }));
      expect(api.callsTo('pinChatMessage')).toHaveLength(0);
    },
  );

  it('sends the message with parse_mode HTML', async () => {
    await sendLeadNotification(makeLead());
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.parse_mode).toBe('HTML');
  });

  it('throws when Telegram returns ok: false', async () => {
    api.fail('sendMessage', 'Bad Request');
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

describe('status rows on the lead detail', () => {
  const statusData = (lead: StoredLead, role: 'owner' | 'admin') =>
    buildLeadDetail(lead, role)
      .reply_markup.inline_keyboard.flat()
      .map((b) => b.callback_data)
      .filter((d) => /^(st|postpone|resume):/.test(d ?? ''));

  it('owner: Сделка/Отказ/Отложить on an open lead, with the lead id embedded', () => {
    expect(statusData(makeLead({ id: 7, status: 'open' }), 'owner')).toEqual([
      'st:7:won',
      'st:7:lost',
      'postpone:7',
    ]);
  });

  it('owner: no status buttons on a won or lost lead', () => {
    expect(statusData(makeLead({ status: 'won' }), 'owner')).toEqual([]);
    expect(statusData(makeLead({ status: 'lost' }), 'owner')).toEqual([]);
  });

  it('admin: no status buttons on an open lead — the owner closes deals', () => {
    expect(statusData(makeLead({ status: 'open' }), 'admin')).toEqual([]);
  });

  it('postponed: just Возобновить, for either role', () => {
    for (const role of ['owner', 'admin'] as const) {
      expect(
        statusData(makeLead({ id: 7, status: 'postponed' }), role),
      ).toEqual(['resume:7']);
    }
  });

  it('labels every status in the card header', () => {
    const labels = LEAD_STATUSES.map(
      (status) =>
        buildLeadDetail(makeLead({ status }), 'owner').text.match(
          /Статус: ([^<]+)/,
        )?.[1],
    );
    expect(labels).toEqual([
      '🔵 Открыта',
      '✅ Сделка',
      '❌ Отказ',
      '⏸️ Отложена',
    ]);
  });
});

describe('unpinLeadCard', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('unpins the stored card', async () => {
    await unpinLeadCard(
      makeLead({ telegramChatId: -1009876543210, telegramMessageId: 555 }),
    );
    expect(api.callsTo('unpinChatMessage').map((c) => c.payload)).toEqual([
      { chat_id: -1009876543210, message_id: 555 },
    ]);
  });

  it('does nothing for a lead without a card', async () => {
    await unpinLeadCard(makeLead());
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('only logs when unpinning fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.fail('unpinChatMessage', 'Bad Request: not enough rights');
    await expect(
      unpinLeadCard(makeLead({ telegramChatId: -1, telegramMessageId: 1 })),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
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
    expect(body.text).toContain('✅ Сделка');
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
    api.fail('editMessageText', description);
    await expect(
      refreshLeadCard(
        makeLead({ telegramChatId: -1009876543210, telegramMessageId: 555 }),
      ),
    ).resolves.toBe(false);
  });

  it('resolves without throwing when Telegram rejects a no-op double-tap edit', async () => {
    api.fail(
      'editMessageText',
      'Bad Request: message is not modified: specified new message content and reply markup are exactly the same',
    );
    await expect(
      refreshLeadCard(
        makeLead({ telegramChatId: -1009876543210, telegramMessageId: 555 }),
      ),
    ).resolves.toBe(true);
  });

  it('still throws on a genuine editMessageText failure', async () => {
    api.fail('editMessageText', 'Bad Request: chat not found');
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
    expect(body.reply_markup).toEqual({ force_reply: true });
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

  it('says when the visitor made the change through the bot', async () => {
    await sendFieldChangeToAdmin(
      makeLead({ service: 'vehicle-import' }),
      'service',
      '',
      'visitor',
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain(': услуга\n🤖 Посетитель через бота');
    expect(body.text).toContain('Было: —');
    expect(body.text).toContain('Стало: vehicle-import');
  });

  it('names a service by its label rather than its slug', async () => {
    await sendFieldChangeToAdmin(
      makeLead({ service: 'vehicle-sourcing' }),
      'service',
      'vehicle-import',
      'visitor',
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('Было: vehicle-import');
    expect(body.text).toContain('Стало: Автоподбор');
  });

  it('leaves the bot marker off an owner edit', async () => {
    await sendFieldChangeToAdmin(
      makeLead({ comment: 'после' }),
      'comment',
      'до',
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).not.toContain('через бота');
  });
});

describe('sendDigest', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  const empty = { stale: [], due: [] };

  it('posts nothing when no Lead needs a decision', async () => {
    expect(await sendDigest(empty)).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('posts one message to the group, a section per reason and a ✅ ❌ ⏳ row per Lead', async () => {
    const sent = await sendDigest({
      stale: [makeLead({ id: 3, name: '<Пётр>' })],
      due: [makeLead({ id: 5, status: 'postponed', name: '' })],
    });

    expect(sent).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-1009876543210');
    expect(body.parse_mode).toBe('HTML');
    expect(body.text.split('\n')).toEqual([
      '<b>📋 Заявки ждут решения</b>',
      '',
      '<b>⏰ Пора вернуться</b>',
      '<a href="https://t.me/approved_test_bot?start=lead_5">#5</a> — · Approved.rs',
      '',
      '<b>🕐 Без движения 7 дней</b>',
      '<a href="https://t.me/approved_test_bot?start=lead_3">#3</a> &lt;Пётр&gt; · Approved.rs',
    ]);
    expect(body.reply_markup.inline_keyboard).toEqual(
      [5, 3].map((id) => [
        { text: `✅ #${id}`, callback_data: `won:${id}` },
        { text: `❌ #${id}`, callback_data: `lost:${id}` },
        { text: `⏳ #${id}`, callback_data: `work:${id}` },
      ]),
    );
  });

  it('caps the rows inside the keyboard and length limits and counts the rest', async () => {
    const many = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) =>
        makeLead({ id: from + i, name: 'Я'.repeat(500) }),
      );

    await sendDigest({
      due: many(1, 15),
      stale: many(200, 15),
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.reply_markup.inline_keyboard).toHaveLength(20);
    expect(body.text).toContain('Без движения');
    expect(body.text.endsWith('+10 ещё')).toBe(true);
    expect(body.text.length).toBeLessThan(4096);
  });

  it('lets a failed send reach the cron', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ description: 'Bad Request' }),
    });
    await expect(
      sendDigest({ ...empty, stale: [makeLead()] }),
    ).rejects.toThrow();
  });
});

describe('sendStatusChangeToAdmin', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it("notifies every admin id with the lead's current status", async () => {
    await sendStatusChangeToAdmin(
      makeLead({ id: 9, name: 'Пётр', status: 'open' }),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(222);
    expect(body.text).toContain('#9');
    expect(body.text).toContain('Пётр');
    expect(body.text).toContain('🔵 Открыта');
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

describe('buildSearchResults', () => {
  it('renders each match as a tappable button: status emoji, id, name, contact', () => {
    const { reply_markup } = buildSearchResults([
      makeLead({
        id: 5,
        name: 'Пётр',
        contact: '@petr',
        status: 'open',
      }),
    ]);
    expect(reply_markup.inline_keyboard).toEqual([
      [{ text: '🔵 #5 Approved.rs Пётр — @petr', callback_data: 'open:5' }],
    ]);
  });

  it('finds a lost lead and marks it lost', () => {
    const { reply_markup } = buildSearchResults([
      makeLead({ id: 5, name: 'Пётр', contact: '@petr', status: 'lost' }),
    ]);
    expect(reply_markup.inline_keyboard[0][0].text).toBe(
      '❌ #5 Approved.rs Пётр — @petr',
    );
  });

  it('reports nothing found for an empty list, no buttons', () => {
    const { text, reply_markup } = buildSearchResults([]);
    expect(text).toBe('Ничего не найдено.');
    expect(reply_markup.inline_keyboard).toEqual([]);
  });
});

describe('buildMenu', () => {
  const data = (role: 'owner' | 'admin') =>
    buildMenu(role, 80)
      .reply_markup.inline_keyboard.flat()
      .map((b) => `${b.text} ${b.callback_data}`);

  it('shows the owner what they owe, with credit, debit and Open, and says search finds lost Leads', () => {
    expect(data('owner')).toEqual([
      '➕ Зачислить ledger:payout',
      '➖ Списать ledger:settlement',
      '📂 Открытые menu:open',
    ]);
    const { text } = buildMenu('owner', 80);
    expect(text).toContain(`<b>💶 Мой долг: ${money(80)}</b>`);
    expect(text).toContain('найдёт и отказы');
  });

  it('shows the admin what they are owed, plus statistics', () => {
    expect(data('admin')).toEqual([
      '➕ Зачислить ledger:payout',
      '➖ Списать ledger:settlement',
      '📂 Открытые menu:open',
      '📊 Статистика menu:stats',
    ]);
    expect(buildMenu('admin', 80).text).toContain(
      `<b>💶 Мне должны: ${money(80)}</b>`,
    );
  });
});

describe('buildBalance', () => {
  it('names the Balance per role and offers credit and debit', () => {
    expect(buildBalance('owner', 12.5)).toEqual({
      text: `<b>💶 Мой долг: ${money(12.5)}</b>`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '➕ Зачислить', callback_data: 'ledger:payout' },
            { text: '➖ Списать', callback_data: 'ledger:settlement' },
          ],
        ],
      },
    });
    expect(buildBalance('admin', 0).text).toBe(
      `<b>💶 Мне должны: ${money(0)}</b>`,
    );
  });
});

describe('operation messages', () => {
  const payout = {
    id: 1,
    type: 'payout' as const,
    amount: 40,
    note: 'Иван <сервис>',
    createdAt: '2026-10-10T00:00:00.000Z',
    createdBy: 'owner' as const,
  };
  const settlement = {
    ...payout,
    type: 'settlement' as const,
    note: '',
    createdBy: 'admin' as const,
  };

  it('confirms with the signed amount and the new Balance', () => {
    expect(operationRecordedText(payout, 80)).toBe(
      `✅ +${money(40)} · баланс ${money(80)}`,
    );
    expect(operationRecordedText(settlement, 40)).toBe(
      `✅ −${money(40)} · баланс ${money(40)}`,
    );
  });

  it('refuses a debit naming the Balance and asks for the amount again', () => {
    expect(operationRefusedText(30)).toBe(
      `⚠️ Списать можно не больше баланса: ${money(30)}\n\n${LEDGER_COPY.prompt.settlement}`,
    );
  });

  it('re-asks with the prompt of the same operation', () => {
    expect(reAskOperationText('settlement', 'no_number')).toBe(
      `${LEDGER_COPY.badAmount}\n\n${LEDGER_COPY.prompt.settlement}`,
    );
  });

  it('re-asks an unacceptable amount naming the limits', () => {
    expect(reAskOperationText('payout', 'bad_amount')).toBe(
      `⚠️ Сумма — от 0,01 до ${money(1_000_000)}, не больше двух знаков после запятой.\n\n${LEDGER_COPY.prompt.payout}`,
    );
  });

  it('notifies naming the author, the escaped note and the Balance', () => {
    expect(operationNoticeText(payout, 80)).toBe(
      `💶 Владелец: +${money(40)} · Иван &lt;сервис&gt; · баланс ${money(80)}`,
    );
    expect(operationNoticeText(settlement, 40)).toBe(
      `💶 Админ: −${money(40)} · баланс ${money(40)}`,
    );
  });
});

describe('sendOperationNotice', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  const operation = {
    id: 1,
    type: 'payout' as const,
    amount: 40,
    note: '',
    createdAt: '2026-10-10T00:00:00.000Z',
  };

  it("tells the admin of the owner's operation", async () => {
    await sendOperationNotice({ ...operation, createdBy: 'owner' }, 40, 111);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(body.chat_id).toBe(222);
    expect(body.text).toBe(`💶 Владелец: +${money(40)} · баланс ${money(40)}`);
  });

  it('tells everyone on both sides except the author', async () => {
    const { sendOperationNotice: notify } = createNotifier({
      client,
      formatter,
      groupId: '-1009876543210',
      ownerIds: [111, 112],
      adminIds: [222, 223],
    });
    await notify({ ...operation, createdBy: 'admin' }, 40, 222);
    const chats = mockFetch.mock.calls.map(
      ([, init]) => JSON.parse(init.body).chat_id,
    );
    expect(chats.sort()).toEqual([111, 112, 223]);
  });
});

describe('buildHelp', () => {
  it('owner text walks the card buttons, card replies and the short menu', () => {
    const text = buildHelp('owner');
    expect(text).toContain('✅ Сделка');
    expect(text).toContain('Ответь на карточку текстом');
    expect(text).not.toContain('Исправить');
    expect(text).not.toContain('Голосовое');
    expect(text).toContain('⏰ Отложить');
    expect(text).toContain('💶 Мой долг. ➕ Зачислить');
    expect(text).toContain('➖ Списать');
    expect(text).not.toContain('Статистика');
    expect(text).not.toContain('Архив');
  });

  it('admin text names statistics and the permanent delete', () => {
    const text = buildHelp('admin');
    expect(text).toContain('📊 Статистика');
    expect(text).toContain('Удалить навсегда');
    expect(text).toContain('💶 Мне должны. ➖ Списать');
    expect(text).not.toContain('Архив');
  });
});

describe('buildOpenList', () => {
  it('lists open and postponed Leads newest first, leaving won and lost out', () => {
    const leads = [
      makeLead({ id: 1, status: 'open' }),
      makeLead({ id: 2, status: 'lost' }),
      makeLead({ id: 3, status: 'postponed' }),
      makeLead({ id: 4, status: 'won' }),
    ];
    const rows = buildOpenList(leads).reply_markup.inline_keyboard.map(
      ([b]) => `${b.text} ${b.callback_data}`,
    );
    expect(rows).toEqual([
      '#3 Иван · Approved.rs · ⏸️ open:3',
      '#1 Иван · Approved.rs · 🔵 open:1',
    ]);
  });

  it('says when nothing is open', () => {
    expect(buildOpenList([makeLead({ status: 'won' })]).text).toBe(
      'Открытых заявок нет.',
    );
  });
});

describe('buildStats', () => {
  const leads = [
    makeLead({ id: 1, status: 'open' }),
    makeLead({ id: 2, status: 'open' }),
    makeLead({ id: 3, status: 'won' }),
    makeLead({ id: 4, status: 'lost' }),
    makeLead({ id: 5, status: 'postponed' }),
  ];

  const NOW = new Date('2026-10-15T12:00:00.000Z');
  const op = (
    over: Partial<LedgerOperation> & Pick<LedgerOperation, 'createdAt'>,
  ): LedgerOperation => ({
    id: 1,
    type: 'payout',
    amount: 100,
    note: '',
    createdBy: 'owner',
    ...over,
  });

  it('counts by status and shows an empty ledger', () => {
    const text = buildStats(leads, [], NOW);
    expect(text).toContain('Всего заявок: 5');
    expect(text).toContain(
      '🔵 Открыта: 2   ⏸️ Отложена: 1   ✅ Сделка: 1   ❌ Отказ: 1',
    );
    expect(text).toContain('<b>💶 Мне должны: 0 €</b>');
    expect(text).toContain('За месяц: +0 € · −0 €');
    expect(text).toContain('Операций не было.');
  });

  it('shows the Balance, month and all-time sums in Belgrade time', () => {
    const text = buildStats(
      [],
      [
        op({ createdAt: '2026-09-30T22:30:00.000Z', amount: 300 }),
        op({ createdAt: '2026-09-29T10:00:00.000Z', amount: 50 }),
        op({
          createdAt: '2026-10-05T10:00:00.000Z',
          type: 'settlement',
          amount: 120.5,
          createdBy: 'admin',
        }),
      ],
      NOW,
    );
    expect(text).toContain('<b>💶 Мне должны: 229,5 €</b>');
    expect(text).toContain('За месяц: +300 € · −120,5 €');
    expect(text).toContain('За всё время: +350 € · −120,5 €');
  });

  it('lists the last 20 operations newest first with date, sign, author and note', () => {
    const operations = Array.from({ length: 22 }, (_, i) =>
      op({
        createdAt: new Date(Date.UTC(2026, 9, 1 + i, 10)).toISOString(),
        amount: i + 1,
      }),
    );
    operations.push(
      op({
        createdAt: '2026-10-23T22:30:00.000Z',
        type: 'settlement',
        amount: 5,
        createdBy: 'admin',
        note: '<cash>',
      }),
    );
    const lines = buildStats([], operations, NOW)
      .split('\n')
      .filter((l) => l.startsWith('• '));
    expect(lines).toHaveLength(20);
    expect(lines[0]).toBe('• 24.10.2026 · −5 € · Админ · &lt;cash&gt;');
    expect(lines[1]).toBe('• 22.10.2026 · +22 € · Владелец');
    expect(lines.at(-1)).toBe('• 04.10.2026 · +4 € · Владелец');
  });

  it('clips a long note to 60 characters', () => {
    const text = buildStats(
      [],
      [op({ createdAt: '2026-10-05T10:00:00.000Z', note: 'x'.repeat(80) })],
      NOW,
    );
    expect(text).toContain(`· ${'x'.repeat(59)}…`);
    expect(text).not.toContain('x'.repeat(60));
  });
});

describe('buildLeadDetail', () => {
  it('open lead: status rows, no edit or archive rows, no money row', () => {
    const { text, reply_markup } = buildLeadDetail(
      makeLead({ id: 7, status: 'open' }),
      'owner',
    );
    expect(text).toContain('#7');
    expect(text).not.toContain('€');
    const data = reply_markup.inline_keyboard
      .flat()
      .map((b) => b.callback_data);
    expect(data).toEqual(['st:7:won', 'st:7:lost', 'postpone:7']);
  });

  it('offers a reply through the bot only when the contact is a Telegram id link', () => {
    const buttons = (contact: string) =>
      buildLeadDetail(makeLead({ id: 7, contact }), 'owner')
        .reply_markup.inline_keyboard.flat()
        .map((b) => b.callback_data);
    expect(buttons('tg://user?id=123456')).toContain('reply:7');
    expect(buttons('@ivan')).not.toContain('reply:7');
    expect(buttons('+381601234567')).not.toContain('reply:7');
  });

  it('offers a reply only for the brands whose capture bot this app relays through', () => {
    const lead = makeLead({ id: 7, contact: 'tg://user?id=123456' });
    const buttons = (detail: ReturnType<typeof buildLeadDetail>) =>
      detail.reply_markup.inline_keyboard.flat().map((b) => b.callback_data);
    expect(buttons(buildLeadDetail(lead, 'owner'))).toContain('reply:7');
    expect(
      buttons(buildLeadDetail({ ...lead, brand: 'Details' }, 'owner')),
    ).toContain('reply:7');
    expect(
      buttons(buildLeadDetail({ ...lead, brand: 'CarLab' }, 'owner')),
    ).not.toContain('reply:7');
    const bare = createFormatter({
      serviceLabel: (slug) => slug,
      botUsername: 'carlab_test_bot',
    });
    expect(buttons(bare.buildLeadDetail(lead, 'owner'))).not.toContain(
      'reply:7',
    );
  });

  it('won lead: no money and no per-Lead pay buttons for either role', () => {
    const lead = makeLead({ id: 7, status: 'won' });
    for (const role of ['owner', 'admin'] as const) {
      const { text, reply_markup } = buildLeadDetail(lead, role);
      expect(text).not.toContain('€');
      expect(
        reply_markup.inline_keyboard
          .flat()
          .some((b) =>
            /^(claimpay|confirmpay|rejectpay):/.test(b.callback_data ?? ''),
          ),
      ).toBe(false);
    }
    expect(
      buildLeadDetail(lead, 'owner')
        .reply_markup.inline_keyboard.flat()
        .some((b) => b.callback_data?.startsWith('st:')),
    ).toBe(false);
  });

  it('active lead: admin gets a permanent-delete row, owner does not', () => {
    const lead = makeLead({ id: 7, status: 'open' });
    const ownerData = buildLeadDetail(lead, 'owner')
      .reply_markup.inline_keyboard.flat()
      .map((b) => b.callback_data);
    const adminData = buildLeadDetail(lead, 'admin')
      .reply_markup.inline_keyboard.flat()
      .map((b) => b.callback_data);
    expect(ownerData).not.toContain('del:7');
    expect(adminData).toContain('del:7');
  });

  it('reuses the full card body — name/contact/comment present', () => {
    const { text } = buildLeadDetail(
      makeLead({
        id: 7,
        comment: 'BMW X5',
        contactChannel: 'whatsapp',
      }),
      'owner',
    );
    expect(text).toContain('Иван');
    expect(text).toContain('@ivan (WhatsApp)');
    expect(text).toContain('BMW X5');
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

  it('renders an expired ghost as lost, keeping its channel line', () => {
    const ghost = makeLead({
      contact: '—',
      service: '',
      services: [],
      kind: 'call_click',
      contactChannel: 'telegram',
      status: 'lost',
    });

    const detail = buildLeadDetail(ghost, 'owner').text;
    expect(detail).toContain('Статус: ❌ Отказ');
    expect(detail).toContain('Клик: Telegram');
    expect(formatter.formatTeaser(ghost)).toContain('❌ Отказ');
    expect(formatter.formatTeaser(ghost)).toContain('Клик: Telegram');
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

  it('names the brand on every open list row', () => {
    const { reply_markup } = buildOpenList([
      makeLead({ id: 3, name: 'Petar', brand: 'AutoHub' }),
    ]);
    expect(reply_markup.inline_keyboard[0][0].text).toContain('AutoHub');
  });

  it('breaks the stats down per brand once more than one business has leads', () => {
    const text = buildStats(
      [
        makeLead({ id: 1, brand: 'Approved.rs' }),
        makeLead({ id: 2, brand: 'PRIZMA' }),
        makeLead({ id: 3, brand: 'PRIZMA' }),
      ],
      [],
      new Date(),
    );
    expect(text).toContain('По брендам: Approved.rs — 1 · PRIZMA — 2');
  });

  it('omits the per-brand breakdown for a single-business store', () => {
    const text = buildStats(
      [makeLead({ brand: 'Approved.rs' })],
      [],
      new Date(),
    );
    expect(text).not.toContain('По брендам');
  });
});
