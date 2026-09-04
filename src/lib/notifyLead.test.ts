import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./telegram', () => ({
  sendLeadNotification: vi.fn(),
  refreshLeadCard: vi.fn(),
}));
// Only insertOrMergeLead/setTelegramMessage need mocking (they touch the
// blob). newStoredLead is pure (spread + Date.now-ish timestamps, no I/O) —
// pull the real implementation through via importOriginal so the
// fallback-path test exercises the actual default-fields shape instead of a
// hand-copied mirror of it that could silently drift from the real one.
vi.mock('./store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./store')>();
  return { ...actual, insertOrMergeLead: vi.fn(), setTelegramMessage: vi.fn() };
});

import { notifyLead } from './notifyLead';
import { sendLeadNotification, refreshLeadCard } from './telegram';
import { insertOrMergeLead, setTelegramMessage } from './store';
import type { LeadData } from './leadTypes';
import type { StoredLead } from './store';

const baseData: Omit<LeadData, 'id'> = {
  name: 'Иван',
  contact: '@ivan',
  service: 'vehicle-sourcing',
  locale: 'ru',
};

const storedLead: StoredLead = {
  ...baseData,
  id: 42,
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
};

describe('notifyLead', () => {
  beforeEach(() => {
    vi.mocked(insertOrMergeLead)
      .mockReset()
      .mockResolvedValue({ lead: storedLead, merged: false });
    vi.mocked(sendLeadNotification)
      .mockReset()
      .mockResolvedValue({ chatId: -100, messageId: 999 });
    vi.mocked(setTelegramMessage).mockReset().mockResolvedValue(storedLead);
    vi.mocked(refreshLeadCard).mockReset().mockResolvedValue(undefined);
  });

  it('inserts into the store, then notifies Telegram with the id-assigned lead', async () => {
    await notifyLead(baseData, '[test]');
    expect(insertOrMergeLead).toHaveBeenCalledWith(baseData);
    expect(sendLeadNotification).toHaveBeenCalledWith(storedLead);
  });

  it('persists the telegram message id after a successful notification', async () => {
    await notifyLead(baseData, '[test]');
    expect(setTelegramMessage).toHaveBeenCalledWith(42, -100, 999);
  });

  it('does not throw when sendLeadNotification fails', async () => {
    vi.mocked(sendLeadNotification).mockRejectedValueOnce(new Error('TG down'));
    await expect(notifyLead(baseData, '[test]')).resolves.toBeUndefined();
  });

  it('falls back to a synthetic untracked lead and still notifies Telegram when the store insert fails', async () => {
    vi.mocked(insertOrMergeLead).mockRejectedValueOnce(new Error('blob down'));

    await notifyLead(baseData, '[test]');

    expect(sendLeadNotification).toHaveBeenCalledTimes(1);
    const notified = vi.mocked(sendLeadNotification).mock.calls[0][0];
    expect(notified.name).toBe('Иван');
    expect(notified.status).toBe('new');
    expect(typeof notified.id).toBe('number');
  });

  it('when merged into an existing lead, refreshes its card instead of sending a new Telegram message', async () => {
    const merged: StoredLead = {
      ...storedLead,
      telegramChatId: -100,
      telegramMessageId: 999,
    };
    vi.mocked(insertOrMergeLead).mockResolvedValueOnce({
      lead: merged,
      merged: true,
    });

    await notifyLead(baseData, '[test]');

    expect(sendLeadNotification).not.toHaveBeenCalled();
    expect(setTelegramMessage).not.toHaveBeenCalled();
    expect(refreshLeadCard).toHaveBeenCalledWith(merged);
  });

  it('when merged but the existing lead has no Telegram message yet, skips the refresh instead of throwing', async () => {
    vi.mocked(insertOrMergeLead).mockResolvedValueOnce({
      lead: storedLead,
      merged: true,
    });

    await expect(notifyLead(baseData, '[test]')).resolves.toBeUndefined();

    expect(refreshLeadCard).not.toHaveBeenCalled();
    expect(sendLeadNotification).not.toHaveBeenCalled();
  });
});
