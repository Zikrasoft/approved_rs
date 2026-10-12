import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { recordBotApi } from '../testing/botApi.ts';
import { createTelegramClient } from './client.ts';
import { createFormatter } from './cards.ts';
import { createNotifier } from './notify.ts';
import { LEAD_STATUSES } from '../schema.ts';
import type { StoredLead } from '../schema.ts';
import type { LedgerOperation } from '../ledgerStore.ts';

import { buildSearchResults, buildMenu, buildOpenList } from './menu.ts';
import {
  buildBalance,
  LEDGER_COPY,
  operationNoticeText,
  operationRecordedText,
  operationRefusedText,
  reAskOperationText,
} from './ledger.ts';
import { buildStats } from './stats.ts';
import {
  buildDeleteConfirm,
  buildRemindPicker,
  EDIT_COPY,
  noteLine,
  reAskEditText,
} from './cards.ts';
import { formatDateRu, leadDisplayName } from './markup.ts';

const SERVICE_LABELS: Record<string, string> = {
  'vehicle-sourcing': 'Автоподбор',
};

const client = createTelegramClient('1001:test-bot-token', 'test_bot');
const formatter = createFormatter({
  serviceLabel: (slug) => SERVICE_LABELS[slug] ?? slug,
  botUsername: 'approved_test_bot',
  groupId: '-1009876543210',
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
  sendUnreadableLedgerToAdmin,
  sendStatusChangeToAdmin,
  sendFieldChange,
  sendContactNote,
  sendDigest,
  editLeadDetailMessage,
  openLeadTopic,
  deleteLeadTopic,
  renameLeadTopic,
  postLeadTopicSummary,
  refreshLeadTopic,
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
    topicId: null,
    topicMessageId: null,
    topicClosed: false,
    topicActiveAt: null,
    questionnaireDone: false,
    referredBy: null,
    managerHandoff: null,
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

describe('createTelegramClient', () => {
  it('takes the bot id from the token', () => {
    expect(client.bot.botInfo.id).toBe(1001);
  });

  it.each(['no-id-token', ':secret', 'abc:secret', '0:secret'])(
    'refuses a token without a bot id: %s',
    (token) => {
      expect(() => createTelegramClient(token, 'test_bot')).toThrow();
    },
  );

  describe('the signal it hands to fetch', () => {
    type CallerSignal = Parameters<typeof client.api.sendMessage>[3];
    beforeEach(() => mockFetchOk());
    afterEach(() => mockFetch.mockReset());

    it('is a native AbortSignal', async () => {
      await client.api.sendMessage(1, 'hi');
      expect(mockFetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it('aborts when the caller aborts mid-request', async () => {
      const caller = new AbortController();
      let received: AbortSignal | undefined;
      mockFetch.mockImplementation((_url: string, init: RequestInit) => {
        received = init.signal ?? undefined;
        caller.abort();
        return api.fetch(_url, init);
      });
      await client.api.sendMessage(
        1,
        'hi',
        undefined,
        caller.signal as CallerSignal,
      );
      expect(received?.aborted).toBe(true);
    });

    it('starts aborted when the caller already aborted', async () => {
      const caller = new AbortController();
      caller.abort();
      await client.api.sendMessage(
        1,
        'hi',
        undefined,
        caller.signal as CallerSignal,
      );
      expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
    });
  });
});

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

  it('says in the teaser when the visitor went to the manager', async () => {
    await sendLeadNotification(
      makeLead({
        telegramId: 77,
        managerHandoff: {
          at: '2026-10-12T10:00:00.000Z',
          handle: 'approvedrs',
        },
      }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('👤 Ушёл к менеджеру @approvedrs · 12.10.2026');
  });

  it('ignores a comment that only quotes the referral note', async () => {
    await sendLeadNotification(
      makeLead({
        telegramId: 77,
        comment: 'Сообщение: Пришёл из бота Approved.rs (Партнёры)',
      }),
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
      ],
      [
        { text: '⏳ В работе', callback_data: 'work:42' },
        { text: '🗣 Переговоры', callback_data: 'talk:42' },
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

  it('owner: Сделка/Отказ/Переговоры/Отложить on an open lead, with the lead id embedded', () => {
    expect(statusData(makeLead({ id: 7, status: 'open' }), 'owner')).toEqual([
      'st:7:won',
      'st:7:lost',
      'st:7:negotiations',
      'postpone:7',
    ]);
  });

  it('owner: Сделка/Отказ/Отложить in negotiations, no second 🗣', () => {
    expect(
      statusData(makeLead({ id: 7, status: 'negotiations' }), 'owner'),
    ).toEqual(['st:7:won', 'st:7:lost', 'postpone:7']);
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
      '🗣 Переговоры',
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

describe('sendContactNote', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('tells the other role a contact went into the notes', async () => {
    await sendContactNote(
      makeLead({ id: 9, name: 'Пётр' }),
      '+381641234567',
      'admin',
      222,
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      chat_id: 111,
      text: '📝 Заявка #9 Пётр · Админ: Доп. контакт: +381641234567',
    });
  });
});

describe('sendFieldChange', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  const sent = () =>
    mockFetch.mock.calls.map(([, init]) => JSON.parse(init.body));

  it('tells the admins what the owner changed, before and after', async () => {
    await sendFieldChange(
      makeLead({ id: 9, name: 'Пётр', contact: '+381641234567' }),
      'contact',
      '—',
      'owner',
      111,
    );
    expect(sent()).toEqual([
      expect.objectContaining({
        chat_id: 222,
        text: '✏️ Заявка #9 Пётр: контакт\n✍️ Владелец\n\nБыло: —\nСтало: +381641234567',
      }),
    ]);
  });

  it('tells the owners what the admin changed, never the author', async () => {
    const both = createNotifier({
      client,
      formatter,
      groupId: '-1009876543210',
      ownerIds: [111, 222],
      adminIds: [222],
    });
    await both.sendFieldChange(
      makeLead({ name: 'x'.repeat(130) }),
      'name',
      '',
      'admin',
      222,
    );
    expect(sent()).toEqual([
      expect.objectContaining({
        chat_id: 111,
        text: expect.stringContaining(
          `✍️ Админ\n\nБыло: —\nСтало: ${'x'.repeat(120)}…`,
        ),
      }),
    ]);
  });

  it('sends nothing when the value did not change', async () => {
    await sendFieldChange(
      makeLead({ name: 'Иван' }),
      'name',
      'Иван',
      'owner',
      111,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('edit copy', () => {
  it('asks again naming what a contact may be, or that a value is required', () => {
    expect(reAskEditText('contact')).toBe(
      `${EDIT_COPY.badContact}\n\n${EDIT_COPY.prompt('contact')}`,
    );
    expect(reAskEditText('name')).toBe(
      `${EDIT_COPY.empty}\n\n✏️ Введите новое значение (имя):`,
    );
  });

  it('signs a note with the Belgrade date and the author', () => {
    expect(noteLine('Звонил', 'admin', new Date('2026-10-15T22:30:00Z'))).toBe(
      '16.10.2026 · Админ: Звонил',
    );
    expect(noteLine('Звонил', 'owner')).toMatch(
      /^\d{2}\.\d{2}\.\d{4} · Владелец: Звонил$/,
    );
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

describe('sendUnreadableLedgerToAdmin', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('tells every admin which file does not parse and that it was left alone', async () => {
    await sendUnreadableLedgerToAdmin('data/ledger.json', '<i>Brand</i>');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(222);
    expect(body.text).toContain('data/ledger.json не читается');
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

describe('buildMenu without a readable ledger', () => {
  it('says the Balance is unavailable and offers no operations', () => {
    const { text, reply_markup } = buildMenu('owner', undefined);
    expect(text).toContain('<b>💶 Мой долг: недоступен</b>');
    expect(reply_markup.inline_keyboard).toEqual([
      [{ text: '📂 Открытые', callback_data: 'menu:open' }],
    ]);
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
    expect(operationRefusedText('settlement', 30)).toBe(
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

  it('logs a recipient it cannot reach and still resolves', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockImplementation(async (url, init) =>
      JSON.parse(init.body).chat_id === 111
        ? new Response(
            JSON.stringify({ ok: false, error_code: 403, description: 'x' }),
          )
        : api.fetch(url, init),
    );
    const { sendOperationNotice: notify } = createNotifier({
      client,
      formatter,
      groupId: '-1009876543210',
      ownerIds: [111],
      adminIds: [222],
    });

    await expect(
      notify({ ...operation, createdBy: 'owner' }, 40, 0),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      '[telegram] a staff notice was not delivered',
      expect.objectContaining({ chatId: 111 }),
    );
    error.mockRestore();
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
  it('lists open, negotiating and postponed Leads newest first, leaving won and lost out', () => {
    const leads = [
      makeLead({ id: 1, status: 'open' }),
      makeLead({ id: 2, status: 'lost' }),
      makeLead({ id: 3, status: 'postponed' }),
      makeLead({ id: 4, status: 'won' }),
      makeLead({ id: 5, status: 'negotiations' }),
    ];
    const rows = buildOpenList(leads).reply_markup.inline_keyboard.map(
      ([b]) => `${b.text} ${b.callback_data}`,
    );
    expect(rows).toEqual([
      '#5 Иван · Approved.rs · 🗣 open:5',
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
    makeLead({ id: 6, status: 'negotiations' }),
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
    expect(text).toContain('Всего заявок: 6');
    expect(text).toContain(
      '🔵 Открыта: 2   🗣 Переговоры: 1   ⏸️ Отложена: 1   ✅ Сделка: 1   ❌ Отказ: 1',
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
  it('open lead: status rows, then edit and note rows, no money row', () => {
    const { text, reply_markup } = buildLeadDetail(
      makeLead({ id: 7, status: 'open' }),
      'owner',
    );
    expect(text).toContain('#7');
    expect(text).not.toContain('€');
    const data = reply_markup.inline_keyboard
      .flat()
      .map((b) => b.callback_data);
    expect(data).toEqual([
      'st:7:won',
      'st:7:lost',
      'st:7:negotiations',
      'postpone:7',
      'edit:7:name',
      'edit:7:contact',
      'note:7',
    ]);
  });

  it('offers no one-shot reply through the bot, even for a Telegram id contact', () => {
    const buttons = buildLeadDetail(
      makeLead({ id: 7, contact: 'tg://user?id=123456' }),
      'owner',
    )
      .reply_markup.inline_keyboard.flat()
      .map((b) => b.callback_data);
    expect(buttons).not.toContain('reply:7');
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
    groupId: '-1009876543210',
  });

  it('does not quote one business rate in help text a shared bot shows every brand', () => {
    expect(detailingFormatter.buildHelp('owner')).not.toMatch(
      /\d+% от прибыли/,
    );
  });

  it('builds its deep link from its own bot username', () => {
    expect(
      detailingFormatter.deepLinkKeyboard(makeLead({ id: 7 }))
        .inline_keyboard[0][0].url,
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

describe('the Lead topic', () => {
  beforeEach(() => {
    api.reset();
    mockFetch.mockImplementation(api.fetch);
  });
  afterEach(() => mockFetch.mockReset());

  it('opens a topic named after the Lead and posts the summary into it', async () => {
    const lead = makeLead({ telegramId: 777, contactChannel: 'telegram' });
    await expect(openLeadTopic(lead)).resolves.toBe(1);
    await expect(postLeadTopicSummary(lead, 1)).resolves.toBe(1000);
    expect(api.callsTo('createForumTopic')[0].payload).toEqual({
      chat_id: '-1009876543210',
      name: '#42 · Иван · Approved.rs',
    });
    expect(api.callsTo('sendMessage')[0].payload).toMatchObject({
      chat_id: '-1009876543210',
      message_thread_id: 1,
      parse_mode: 'HTML',
      text: expect.stringContaining(
        'Контакт: <a href="https://t.me/ivan">@ivan</a> (Telegram)',
      ),
    });
  });

  it('renames a topic after the Lead, and leaves a Lead without one alone', async () => {
    await renameLeadTopic(makeLead({ topicId: 7, name: 'Пётр' }));
    await renameLeadTopic(makeLead());
    expect(api.callsTo('editForumTopic').map((c) => c.payload)).toEqual([
      {
        chat_id: '-1009876543210',
        message_thread_id: 7,
        name: '#42 · Пётр · Approved.rs',
      },
    ]);
  });

  it('logs a topic it could not rename', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.fail('editForumTopic', 'Bad Request: TOPIC_NOT_MODIFIED');
    await renameLeadTopic(makeLead({ topicId: 7 }));
    expect(error).toHaveBeenCalledWith(
      '[telegram] editForumTopic failed',
      expect.objectContaining({ topicId: 7 }),
    );
    error.mockRestore();
  });

  it('deletes a topic by id', async () => {
    await deleteLeadTopic(7);
    expect(api.callsTo('deleteForumTopic')[0].payload).toEqual({
      chat_id: '-1009876543210',
      message_thread_id: 7,
    });
  });

  it('offers to start a conversation only with a Lead the bot knows and no topic', () => {
    const START = { text: '💬 Начать переписку', callback_data: 'topic:42' };
    const buttons = (keyboard: { inline_keyboard: object[][] }) =>
      keyboard.inline_keyboard.flat();
    const known = makeLead({ telegramId: 777 });
    expect(buttons(formatter.deepLinkKeyboard(known))).toContainEqual(START);
    expect(
      buttons(buildLeadDetail(known, 'admin').reply_markup),
    ).toContainEqual(START);
    expect(
      buttons(
        formatter.deepLinkKeyboard(makeLead({ telegramId: 777, topicId: 9 })),
      ),
    ).not.toContainEqual(START);
    expect(buttons(formatter.deepLinkKeyboard(makeLead()))).not.toContainEqual(
      START,
    );
  });

  it('caps the topic name at Telegram limit', () => {
    expect(
      formatter.topicName(makeLead({ name: 'Я'.repeat(300) })),
    ).toHaveLength(128);
  });

  it('leaves a phone or an id contact as plain text in the summary', () => {
    expect(
      formatter.topicSummaryText(
        makeLead({ contact: '+381601234567', contactChannel: null }),
      ),
    ).toContain('Контакт: +381601234567\n');
  });

  it('edits the summary in place, and does nothing without one', async () => {
    await refreshLeadTopic(makeLead({ topicId: 3, topicMessageId: 55 }));
    expect(api.callsTo('editMessageText')[0].payload).toMatchObject({
      chat_id: '-1009876543210',
      message_id: 55,
      parse_mode: 'HTML',
    });
    await refreshLeadTopic(makeLead({ topicId: 3 }));
    expect(api.callsTo('editMessageText')).toHaveLength(1);
  });

  it('links the card and the detail to the topic once there is one', () => {
    const urls = (keyboard: { inline_keyboard: { url?: string }[][] }) =>
      keyboard.inline_keyboard.flat().map((b) => b.url);
    expect(
      urls(formatter.deepLinkKeyboard(makeLead({ topicId: 9 }))),
    ).toContain('https://t.me/c/9876543210/9');
    expect(
      urls(buildLeadDetail(makeLead({ topicId: 9 }), 'owner').reply_markup),
    ).toContain('https://t.me/c/9876543210/9');
    expect(urls(formatter.deepLinkKeyboard(makeLead()))).not.toContain(
      'https://t.me/c/9876543210/9',
    );
  });
});
