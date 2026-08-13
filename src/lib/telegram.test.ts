import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { sendLeadNotification } from './telegram';
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

  it('makes exactly 1 fetch call (group only)', async () => {
    await sendLeadNotification(mockLead);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('sends a plain notification with no inline keyboard', async () => {
    await sendLeadNotification(mockLead);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-1009876543210');
    expect(body.reply_markup).toBeUndefined();
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

  it('includes the row link in the message when a rowUrl is given', async () => {
    await sendLeadNotification(mockLead, 'https://docs.google.com/spreadsheets/d/abc/edit#gid=0&range=A5');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('Таблица: https://docs.google.com/spreadsheets/d/abc/edit#gid=0&range=A5');
  });

  it('omits the row link line when no rowUrl is given', async () => {
    await sendLeadNotification(mockLead);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).not.toContain('Таблица:');
  });
});
