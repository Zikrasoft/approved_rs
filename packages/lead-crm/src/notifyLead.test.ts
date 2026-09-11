import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotifyLead } from './notifyLead.ts';
import { createLeadSchema, type LeadInput, type StoredLead } from './schema.ts';
import { createLeadStore } from './store.ts';
import { createMemoryStorage } from './storage/memory.testing.ts';

const insertOrMergeLead = vi.fn();
const setTelegramMessage = vi.fn();
const sendLeadNotification = vi.fn();
const refreshLeadCard = vi.fn();

// newStoredLead stays real — it is pure (spread + timestamps, no I/O), so the
// fallback-path test exercises the actual default-fields shape instead of a
// hand-copied mirror that could silently drift from it.
const realStore = createLeadStore({
  storage: createMemoryStorage(),
  schema: createLeadSchema({
    locales: ['ru', 'en', 'sr', 'es', 'de'],
    defaultCommissionPercent: 10,
  }),
});

const store = {
  newStoredLead: realStore.newStoredLead,
  insertOrMergeLead,
  setTelegramMessage,
};

const notifier = { sendLeadNotification, refreshLeadCard };

const notifyLead = createNotifyLead({ store, notifier });

const baseData: LeadInput = {
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

beforeEach(() => {
  insertOrMergeLead.mockReset().mockResolvedValue({
    lead: storedLead,
    merged: false,
  });
  sendLeadNotification.mockReset().mockResolvedValue({
    chatId: -100,
    messageId: 999,
  });
  setTelegramMessage.mockReset().mockResolvedValue(storedLead);
  refreshLeadCard.mockReset().mockResolvedValue(undefined);
});

describe('notifyLead', () => {
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

describe('notifyLead — failures that must not sink the lead', () => {
  it("still finishes when refreshing a merged lead's card fails", async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    insertOrMergeLead.mockResolvedValue({
      lead: { ...storedLead, telegramChatId: -100, telegramMessageId: 5 },
      merged: true,
    });
    refreshLeadCard.mockRejectedValue(new Error('telegram down'));

    await expect(notifyLead(baseData, '[test]')).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      "[test] failed to refresh the merged lead's card",
      expect.objectContaining({ leadId: 42 }),
    );
    errorSpy.mockRestore();
  });

  it('keeps the lead when persisting the Telegram message id fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setTelegramMessage.mockRejectedValue(new Error('storage down'));

    await expect(notifyLead(baseData, '[test]')).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      '[test] failed to persist telegram message id',
      expect.objectContaining({ leadId: 42 }),
    );
    errorSpy.mockRestore();
  });
});

describe('notifyLead — lead that cannot be validated at all', () => {
  it('logs and gives up instead of throwing out of the fire-and-forget call', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    insertOrMergeLead.mockRejectedValue(new Error('storage down'));

    await expect(
      notifyLead({ ...baseData, locale: 'not-a-locale' }, '[test]'),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      '[test] lead failed validation, cannot notify',
      expect.objectContaining({ lead: expect.anything() }),
    );
    expect(sendLeadNotification).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
