import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  sendLeadNotification, statusLabel, isLeadStatusKey, buildStatusKeyboard, refreshLeadCard,
  answerCallback, sendForceReplyPrompt, sendDealNotificationToAdmin, sendCommissionClaimToAdmin,
  sendCommissionResultToOwner, buildOwedSummary, formatDealsList, formatSearchResults, buildMenu,
  buildLeadList, buildStats, buildLeadDetail, editLeadDetailMessage,
} from './index';
import type { StoredLead, LeadStatus } from '../store';

function makeLead(overrides: Partial<StoredLead> = {}): StoredLead {
  return {
    id: 42,
    name: 'Иван',
    contact: '@ivan',
    service: 'vehicle-sourcing',
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
    lastRemindedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    pendingPrompt: null,
    archived: false,
    customerPaidAt: null,
    pendingCommissionClaim: null,
    ...overrides,
  };
}

// Intl.NumberFormat('ru-RU') uses a non-breaking thousands separator that
// isn't a plain U+0020 space — build expectations from the same formatter
// instead of hardcoding a literal that looks right but silently isn't.
function money(n: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(n)} ₽`;
}

function mockFetchOk(result: unknown = { message_id: 999, chat: { id: -1009876543210 } }) {
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
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { message_id: 999, chat: { id: -1009876543210 } } }) })
      .mockResolvedValueOnce({ ok: false, status: 400, json: () => Promise.resolve({ description: 'Bad Request' }) });
    await expect(sendLeadNotification(makeLead())).resolves.toEqual({ chatId: -1009876543210, messageId: 999 });
  });

  it('throws when the sendMessage response is missing message_id or chat.id', async () => {
    mockFetchOk({});
    await expect(sendLeadNotification(makeLead())).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sends only a minimal teaser — id, name, service, status — no contact/comment/PII', async () => {
    await sendLeadNotification(makeLead({ id: 42, comment: 'BMW X5', source_url: '/x/' }));
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
    mockFetch.mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ description: 'Bad Request' }) });
    await expect(sendLeadNotification(makeLead())).rejects.toThrow();
  });
});

describe('statusLabel', () => {
  it('returns "Новая" for the new status', () => {
    expect(statusLabel('new')).toBe('Новая');
  });

  it('maps known status keys to their Russian label', () => {
    expect(statusLabel('in_progress')).toBe('В работе');
    expect(statusLabel('won')).toBe('Успешно');
    expect(statusLabel('lost')).toBe('Отказ');
  });

  it('falls back to the raw value for an unknown status (defensive, should not happen)', () => {
    expect(statusLabel('bogus' as unknown as LeadStatus)).toBe('bogus');
  });
});

describe('isLeadStatusKey', () => {
  it('is true only for the 3 known status keys', () => {
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
  it('shows В работу/Отказ for a new lead, with the lead id embedded in callback_data', () => {
    const kb = buildStatusKeyboard(makeLead({ id: 7, status: 'new' }));
    expect(kb.inline_keyboard[0].map(b => b.callback_data)).toEqual(['st:7:in_progress', 'st:7:lost']);
  });

  it('shows Завершить/Отказ for an in-progress lead', () => {
    const kb = buildStatusKeyboard(makeLead({ id: 7, status: 'in_progress' }));
    expect(kb.inline_keyboard[0].map(b => b.callback_data)).toEqual(['st:7:won', 'st:7:lost']);
  });

  it('has no buttons for a terminal (won/lost) lead', () => {
    expect(buildStatusKeyboard(makeLead({ status: 'won' })).inline_keyboard).toEqual([]);
    expect(buildStatusKeyboard(makeLead({ status: 'lost' })).inline_keyboard).toEqual([]);
  });
});

describe('refreshLeadCard', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('rebuilds the teaser and deep-link button from the current lead and edits the group message', async () => {
    const lead = makeLead({ id: 42, status: 'won', telegramChatId: -1009876543210, telegramMessageId: 555 });
    await refreshLeadCard(lead);

    expect(mockFetch.mock.calls[0][0]).toContain('/editMessageText');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(-1009876543210);
    expect(body.message_id).toBe(555);
    expect(body.text).toContain('✅ Успешно');
    expect(body.reply_markup.inline_keyboard[0][0].url).toBe('https://t.me/approved_test_bot?start=lead_42');
  });

  it('does nothing when the lead has no Telegram message on file yet', async () => {
    await refreshLeadCard(makeLead({ telegramChatId: null, telegramMessageId: null }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does nothing for a chat id other than the managed group', async () => {
    await refreshLeadCard(makeLead({ telegramChatId: -1, telegramMessageId: 1 }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('resolves without throwing when Telegram rejects a no-op double-tap edit', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ description: 'Bad Request: message is not modified: specified new message content and reply markup are exactly the same' }),
    });
    await expect(refreshLeadCard(makeLead({ telegramChatId: -1009876543210, telegramMessageId: 555 }))).resolves.toBeUndefined();
  });

  it('still throws on a genuine editMessageText failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ description: 'Bad Request: message to edit not found' }) });
    await expect(refreshLeadCard(makeLead({ telegramChatId: -1009876543210, telegramMessageId: 555 }))).rejects.toThrow();
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

describe('sendDealNotificationToAdmin', () => {
  beforeEach(() => mockFetchOk({ message_id: 1 }));
  afterEach(() => mockFetch.mockReset());

  it('computes commission from commissionPercent — informational only, no button', async () => {
    await sendDealNotificationToAdmin(makeLead({ id: 9, dealAmount: 100000, commissionPercent: 10 }));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('222');
    expect(body.text).toContain(`Комиссия (10%): ${money(10000)}`);
    expect(body.reply_markup).toBeUndefined();
  });

  it('does nothing when the deal has no amount yet', async () => {
    await sendDealNotificationToAdmin(makeLead({ dealAmount: null }));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('sendCommissionClaimToAdmin', () => {
  beforeEach(() => mockFetchOk({ message_id: 1 }));
  afterEach(() => mockFetch.mockReset());

  it('notifies the admin with confirm/reject buttons for the claimed amount', async () => {
    await sendCommissionClaimToAdmin(makeLead({ id: 9, pendingCommissionClaim: { amount: 4000, claimedAt: '2026-01-01T00:00:00.000Z' } }));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('222');
    expect(body.text).toContain(money(4000));
    const buttons = body.reply_markup.inline_keyboard[0];
    expect(buttons.map((b: { callback_data: string }) => b.callback_data)).toEqual(['confirmpay:9', 'rejectpay:9']);
  });

  it('does nothing without a pending claim', async () => {
    await sendCommissionClaimToAdmin(makeLead({ pendingCommissionClaim: null }));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('sendCommissionResultToOwner', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('tells the owner the payment was confirmed', async () => {
    await sendCommissionResultToOwner(makeLead({ id: 9 }), true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('111');
    expect(body.text).toContain('подтверждена');
  });

  it('tells the owner the payment was rejected', async () => {
    await sendCommissionResultToOwner(makeLead({ id: 9 }), false);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('не подтверждена');
  });
});

describe('buildOwedSummary', () => {
  it('lists each row with its remaining amount, plus a total', () => {
    const text = buildOwedSummary([{ id: 1, name: 'Иван', dealAmount: 100000, commissionAmount: 10000, paidAmount: 0, remaining: 10000 }], 10000);
    expect(text).toContain(`#1 Иван — ${money(10000)}`);
    expect(text).toContain(`Итого: ${money(10000)}`);
  });

  it('reports no debt when there are no rows, with the same bold header as the non-empty case', () => {
    expect(buildOwedSummary([], 0)).toBe('<b>🔴 Мне должны</b>\n\n🟢 Всё оплачено, долгов нет.');
  });
});

describe('formatDealsList', () => {
  it('marks an unpaid deal 🔴', () => {
    const text = formatDealsList([makeLead({ id: 1, status: 'won', dealAmount: 100000, paidAmount: 0 })]);
    expect(text).toContain('🔴 Не оплачено');
  });

  it('marks a partially-paid deal 🟡 with both amounts', () => {
    const text = formatDealsList([makeLead({ id: 1, status: 'won', dealAmount: 100000, paidAmount: 3000 })]);
    expect(text).toContain(`🟡 Оплачено ${money(3000)} из ${money(10000)}`);
  });

  it('marks a fully-paid deal 🟢', () => {
    const text = formatDealsList([makeLead({ id: 1, status: 'won', dealAmount: 100000, paidAmount: 10000 })]);
    expect(text).toContain('🟢 Оплачено');
  });

  it('excludes archived deals', () => {
    const text = formatDealsList([makeLead({ id: 1, status: 'won', dealAmount: 100000, archived: true })]);
    expect(text).toBe('<b>💰 Все сделки</b>\n\nСделок пока нет.');
  });

  it('reports nothing when there are no deals, with the same bold header as the non-empty case', () => {
    expect(formatDealsList([])).toBe('<b>💰 Все сделки</b>\n\nСделок пока нет.');
  });

  it('caps at 20 deals, newest first', () => {
    const leads = Array.from({ length: 25 }, (_, i) => makeLead({ id: i + 1, status: 'won', dealAmount: 10000 }));
    const text = formatDealsList(leads);
    const shown = [...text.matchAll(/#(\d+)/g)].map(m => Number(m[1]));
    expect(shown).toHaveLength(20);
    expect(shown[0]).toBe(25);
  });
});

describe('formatSearchResults', () => {
  it('formats each match with status emoji, id, name, contact', () => {
    const text = formatSearchResults([makeLead({ id: 5, name: 'Пётр', contact: '@petr', status: 'in_progress' })]);
    expect(text).toBe('🔵 #5 Пётр — @petr');
  });

  it('prefixes an archived match with 🗄', () => {
    const text = formatSearchResults([makeLead({ id: 5, name: 'Пётр', contact: '@petr', archived: true })]);
    expect(text).toBe('🗄 🆕 #5 Пётр — @petr');
  });

  it('reports nothing found for an empty list', () => {
    expect(formatSearchResults([])).toBe('Ничего не найдено.');
  });
});

describe('buildMenu', () => {
  it('gives the owner lead lists + stats, no debt/deals entries', () => {
    const menu = buildMenu('owner');
    const data = menu.reply_markup.inline_keyboard.flat().map(b => b.callback_data);
    expect(data).toEqual(['list:new', 'list:in_progress', 'list:won', 'list:lost', 'menu:stats']);
  });

  it('gives the admin the same lists plus debt/deals', () => {
    const menu = buildMenu('admin');
    const data = menu.reply_markup.inline_keyboard.flat().map(b => b.callback_data);
    expect(data).toEqual(['list:new', 'list:in_progress', 'list:won', 'list:lost', 'menu:stats', 'menu:debt', 'menu:deals']);
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
    const data = list.reply_markup.inline_keyboard.map(row => row[0].callback_data);
    expect(data).toEqual(['open:3', 'open:1']);
  });

  it('reports an empty bucket', () => {
    expect(buildLeadList([], 'new').text).toBe('Пусто.');
  });
});

describe('buildStats', () => {
  it('counts by status and sums money across won leads, excluding archived', () => {
    const leads = [
      makeLead({ id: 1, status: 'new' }),
      makeLead({ id: 2, status: 'in_progress' }),
      makeLead({ id: 3, status: 'won', dealAmount: 100000, paidAmount: 4000 }),
      makeLead({ id: 4, status: 'lost' }),
      makeLead({ id: 5, status: 'new', archived: true }),
    ];
    const text = buildStats(leads);
    expect(text).toContain('Всего заявок: 4 (+1 в архиве)');
    expect(text).toContain(`💰 Оборот (сумма сделок): ${money(100000)}`);
    expect(text).toContain(`Комиссия начислена: ${money(10000)}`);
    expect(text).toContain(`Оплачено: ${money(4000)}`);
    expect(text).toContain(`🔴 Осталось получить: ${money(6000)}`);
  });
});

describe('buildLeadDetail', () => {
  it('new lead: status buttons + edit row + archive row, no money row', () => {
    const { text, reply_markup } = buildLeadDetail(makeLead({ id: 7, status: 'new' }), 'owner');
    expect(text).toContain('#7');
    expect(text).not.toContain('Комиссия Zikrasoft');
    const rows = reply_markup.inline_keyboard;
    expect(rows[0].map(b => b.callback_data)).toEqual(['st:7:in_progress', 'st:7:lost']);
    expect(rows[1].map(b => b.callback_data)).toEqual(['edit:7:name', 'edit:7:contact', 'edit:7:comment']);
    expect(rows[rows.length - 1]).toEqual([{ text: '🗑 Архивировать', callback_data: 'arch:7' }]);
  });

  it('in_progress lead: Завершить/Отказ status row', () => {
    const { reply_markup } = buildLeadDetail(makeLead({ id: 7, status: 'in_progress' }), 'owner');
    expect(reply_markup.inline_keyboard[0].map(b => b.callback_data)).toEqual(['st:7:won', 'st:7:lost']);
  });

  it('won lead, owner, no claim pending: customer-paid toggle + a claim button', () => {
    const lead = makeLead({ id: 7, status: 'won', dealAmount: 100000, paidAmount: 0 });
    const { text, reply_markup } = buildLeadDetail(lead, 'owner');
    expect(text).toContain('🧾 Оплата клиента: ⏳ не отмечена');
    expect(text).toContain('Осталось:');
    const data = reply_markup.inline_keyboard.flat().map(b => b.callback_data);
    expect(data).toContain('custpaid:7');
    expect(data).toContain('claimpay:7');
    expect(reply_markup.inline_keyboard[0].some(b => b.callback_data?.startsWith('st:'))).toBe(false);
  });

  it('won lead, owner, claim pending: shows waiting line, no claim button', () => {
    const lead = makeLead({ id: 7, status: 'won', dealAmount: 100000, pendingCommissionClaim: { amount: 3000, claimedAt: '2026-01-01T00:00:00.000Z' } });
    const { text, reply_markup } = buildLeadDetail(lead, 'owner');
    expect(text).toContain(`🕓 Ожидает подтверждения: ${money(3000)}`);
    expect(reply_markup.inline_keyboard.flat().map(b => b.callback_data)).not.toContain('claimpay:7');
  });

  it('won lead, admin, no remaining and no pending claim: no money buttons at all', () => {
    const lead = makeLead({ id: 7, status: 'won', dealAmount: 100000, paidAmount: 10000 });
    const { reply_markup } = buildLeadDetail(lead, 'admin');
    const data = reply_markup.inline_keyboard.flat().map(b => b.callback_data);
    expect(data).not.toContain('confirmpay:7');
    expect(data).not.toContain('rejectpay:7');
    expect(data).not.toContain('custpaid:7');
  });

  it('won lead, admin, claim pending: shows confirm/reject', () => {
    const lead = makeLead({ id: 7, status: 'won', dealAmount: 100000, pendingCommissionClaim: { amount: 3000, claimedAt: '2026-01-01T00:00:00.000Z' } });
    const { reply_markup } = buildLeadDetail(lead, 'admin');
    const data = reply_markup.inline_keyboard.flat().map(b => b.callback_data);
    expect(data).toEqual(expect.arrayContaining(['confirmpay:7', 'rejectpay:7']));
  });

  it('lost lead: no money row regardless of role', () => {
    const { text, reply_markup } = buildLeadDetail(makeLead({ id: 7, status: 'lost' }), 'admin');
    expect(text).not.toContain('Комиссия Zikrasoft');
    expect(reply_markup.inline_keyboard.flat().map(b => b.callback_data)).not.toContain('custpaid:7');
  });

  it('archived lead: only a restore button, regardless of status/role', () => {
    const { text, reply_markup } = buildLeadDetail(makeLead({ id: 7, status: 'won', dealAmount: 100000, archived: true }), 'owner');
    expect(text).toContain('🗄 В архиве');
    expect(reply_markup.inline_keyboard).toEqual([[{ text: '♻️ Восстановить', callback_data: 'unarch:7' }]]);
  });

  it('reuses the full card body — name/contact/comment/deal amount present', () => {
    const { text } = buildLeadDetail(makeLead({ id: 7, dealAmount: 50000, comment: 'BMW X5', contactChannel: 'whatsapp' }), 'owner');
    expect(text).toContain('Иван');
    expect(text).toContain('@ivan (WhatsApp)');
    expect(text).toContain('BMW X5');
    expect(text).toContain(money(50000));
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
    expect(body).toEqual({ callback_query_id: 'cb-1', text: 'Статус обновлён' });
  });
});
