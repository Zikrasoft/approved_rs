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
});
