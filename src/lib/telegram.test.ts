import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { sendLeadNotification, editGroupMessage, answerCallbackQuery } from './telegram';
import type { LeadData } from './telegram';

const mockLead: LeadData = {
  id: 42,
  name: 'Иван',
  contact: '@ivan',
  service: 'autopodbor',
  comment: 'BMW X5',
  country: 'de',
  source_url: '/de/autopodbor/',
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

  it('makes exactly 1 fetch call (group only)', async () => {
    await sendLeadNotification(mockLead);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('posts to group with 3-button inline keyboard', async () => {
    await sendLeadNotification(mockLead);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-1009876543210');
    expect(body.reply_markup.inline_keyboard[0]).toHaveLength(3);
  });

  it('buttons have correct callback_data with lead id', async () => {
    await sendLeadNotification(mockLead);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const buttons = body.reply_markup.inline_keyboard[0];
    expect(buttons[0].callback_data).toBe('accept:42');
    expect(buttons[1].callback_data).toBe('close:42');
    expect(buttons[2].callback_data).toBe('spam:42');
  });

  it('message text contains lead id, service label, name, contact', async () => {
    await sendLeadNotification(mockLead);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-1009876543210');
    expect(body.text).toContain('#42');
    expect(body.text).toContain('Автоподбор');
    expect(body.text).toContain('Иван');
    expect(body.text).toContain('@ivan');
  });

  it('throws when Telegram returns ok: false', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ description: 'Bad Request' }) });
    await expect(sendLeadNotification(mockLead)).rejects.toThrow();
  });
});

describe('editGroupMessage', () => {
  beforeEach(() => mockFetchOk(true));
  afterEach(() => mockFetch.mockReset());

  it('calls editMessageText with correct chat_id and message_id', async () => {
    await editGroupMessage(999, 'Original text', 'manager1', 'in_progress');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-1009876543210');
    expect(body.message_id).toBe(999);
  });

  it('appends handler name to text and clears keyboard', async () => {
    await editGroupMessage(999, 'Original text', 'manager1', 'in_progress');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('manager1');
    expect(body.reply_markup.inline_keyboard).toEqual([]);
  });
});

describe('answerCallbackQuery', () => {
  beforeEach(() => mockFetchOk(true));
  afterEach(() => mockFetch.mockReset());

  it('calls answerCallbackQuery endpoint', async () => {
    await answerCallbackQuery('cq_123');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('answerCallbackQuery'),
      expect.any(Object)
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.callback_query_id).toBe('cq_123');
  });
});
