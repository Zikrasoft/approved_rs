import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { sendLeadNotification, statusLabel, isLeadStatusKey, buildStatusKeyboard, updateLeadStatus, answerCallback } from './telegram';
import type { LeadData } from './telegram';

const mockLead: LeadData = {
  id: 42,
  name: 'Иван',
  contact: '@ivan',
  service: 'vehicle-sourcing',
  comment: 'BMW X5',
  country: 'de',
  source_url: '/ru/vehicle-sourcing/de/',
  locale: 'ru',
};

function mockFetchOk(result: unknown = { message_id: 999 }) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ result }),
  });
}

describe('sendLeadNotification', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('makes exactly 2 fetch calls (send + pin)', async () => {
    await sendLeadNotification(mockLead);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('pins the sent message', async () => {
    await sendLeadNotification(mockLead);
    const pinBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(mockFetch.mock.calls[1][0]).toContain('/pinChatMessage');
    expect(pinBody.chat_id).toBe('-1009876543210');
    expect(pinBody.message_id).toBe(999);
  });

  it('still sends the notification if pinning fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: { message_id: 999 } }) })
      .mockResolvedValueOnce({ ok: false, status: 400, json: () => Promise.resolve({ description: 'Bad Request' }) });
    await expect(sendLeadNotification(mockLead)).resolves.toBeUndefined();
  });

  it('skips pinning without throwing when sendMessage response has no message_id', async () => {
    mockFetchOk({});
    await expect(sendLeadNotification(mockLead)).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sends the notification with the status keyboard attached, no active status yet', async () => {
    await sendLeadNotification(mockLead);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-1009876543210');
    expect(body.reply_markup.inline_keyboard[0]).toHaveLength(3);
    expect(body.reply_markup.inline_keyboard[0].every((btn: { text: string }) => !btn.text.includes('✓'))).toBe(true);
  });

  it('message text contains lead id, service label, name, contact, and the default status', async () => {
    await sendLeadNotification(mockLead);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-1009876543210');
    expect(body.text).toContain('#42');
    expect(body.text).toContain('Автоподбор');
    expect(body.text).toContain('Иван');
    expect(body.text).toContain('@ivan');
    expect(body.text).toContain('<b>Статус: 🆕 Новая</b>');
  });

  it('sends the message with parse_mode HTML so the status line renders bold', async () => {
    await sendLeadNotification(mockLead);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.parse_mode).toBe('HTML');
  });

  it('HTML-escapes a comment containing special characters', async () => {
    await sendLeadNotification({ ...mockLead, comment: 'Цена < 5000 & срочно' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('Цена &lt; 5000 &amp; срочно');
  });

  it('throws when Telegram returns ok: false', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ description: 'Bad Request' }) });
    await expect(sendLeadNotification(mockLead)).rejects.toThrow();
  });

  it('appends the channel label to the contact line for a tracked channel', async () => {
    await sendLeadNotification({ ...mockLead, contactChannel: 'whatsapp' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('Контакт: @ivan (WhatsApp)');
  });

  it('drops the channel label for an untracked/prototype-key contactChannel instead of leaking it', async () => {
    await sendLeadNotification({ ...mockLead, contactChannel: 'constructor' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('Контакт: @ivan');
    expect(body.text).not.toMatch(/Контакт: @ivan \(/);
  });

  it('includes the visitor ID line when present', async () => {
    await sendLeadNotification({ ...mockLead, visitorId: 'abc-123' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('ID посетителя: abc-123');
  });

  it('omits the visitor ID line when absent', async () => {
    await sendLeadNotification(mockLead);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).not.toContain('ID посетителя');
  });

  it('caps an oversized visitor ID instead of letting it blow past the message limit', async () => {
    await sendLeadNotification({ ...mockLead, visitorId: 'x'.repeat(500) });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const line = body.text.split('\n').find((l: string) => l.startsWith('ID посетителя: '));
    expect(line.length).toBe('ID посетителя: '.length + 100);
  });
});

describe('statusLabel', () => {
  it('defaults to "Новая" for undefined/null/"new"', () => {
    expect(statusLabel()).toBe('Новая');
    expect(statusLabel(null)).toBe('Новая');
    expect(statusLabel('new')).toBe('Новая');
  });

  it('maps known status keys to their Russian label', () => {
    expect(statusLabel('in_progress')).toBe('В работе');
    expect(statusLabel('won')).toBe('Успешно');
    expect(statusLabel('lost')).toBe('Отказ');
  });

  it('falls back to the raw key for an unknown status', () => {
    expect(statusLabel('bogus')).toBe('bogus');
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
  it('marks the active status with a checkmark and leaves the others plain', () => {
    const kb = buildStatusKeyboard('won');
    const buttons = kb.inline_keyboard[0];
    expect(buttons.find(b => b.callback_data === 'st:won')!.text).toContain('✓');
    expect(buttons.find(b => b.callback_data === 'st:lost')!.text).not.toContain('✓');
  });

  it('checks nothing when no status is active', () => {
    const kb = buildStatusKeyboard();
    expect(kb.inline_keyboard[0].every(b => !b.text.includes('✓'))).toBe(true);
  });
});

describe('updateLeadStatus', () => {
  beforeEach(() => mockFetchOk());
  afterEach(() => mockFetch.mockReset());

  it('replaces the Статус line and re-renders the keyboard with the new active status', async () => {
    const original = '🚗 Заявка #42 — Автоподбор\nСтатус: Новая\n\nИмя: Иван';
    await updateLeadStatus(-1009876543210, 555, original, 'won');

    expect(mockFetch.mock.calls[0][0]).toContain('/editMessageText');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe(-1009876543210);
    expect(body.message_id).toBe(555);
    expect(body.parse_mode).toBe('HTML');
    expect(body.text).toContain('<b>Статус: ✅ Успешно</b>');
    expect(body.text).toContain('Имя: Иван');
    expect(body.reply_markup.inline_keyboard[0].find((b: { callback_data: string }) => b.callback_data === 'st:won').text).toContain('✓');
  });

  it('re-escapes the rest of the message so a decoded special character surviving from before does not break HTML parsing', async () => {
    const original = 'Статус: Новая\n\nКомментарий: Цена < 5000 & срочно';
    await updateLeadStatus(-1009876543210, 555, original, 'won');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('Цена &lt; 5000 &amp; срочно');
  });

  it('leaves text untouched if no Статус line is found (defensive, should not happen in practice)', async () => {
    await updateLeadStatus(-1009876543210, 1, 'no status line here', 'won');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toBe('no status line here');
  });

  it('does nothing for a chat id other than the managed group', async () => {
    await updateLeadStatus(-1, 1, 'Статус: Новая', 'won');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('resolves without throwing when Telegram rejects a no-op double-tap edit', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ description: 'Bad Request: message is not modified: specified new message content and reply markup are exactly the same' }),
    });
    await expect(updateLeadStatus(-1009876543210, 555, 'Статус: Успешно', 'won')).resolves.toBeUndefined();
  });

  it('still throws on a genuine editMessageText failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ description: 'Bad Request: message to edit not found' }) });
    await expect(updateLeadStatus(-1009876543210, 555, 'Статус: Новая', 'won')).rejects.toThrow();
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
