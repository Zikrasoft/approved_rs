import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAfterStatusChange,
  createDropFromDigest,
  createEnsureLeadCard,
  createEnsureLeadTopic,
  createNotifyLead,
} from './notifyLead.ts';
import { storedLeadSchema, type LeadInput, type StoredLead } from './schema.ts';
import { createLeadStore } from './store.ts';
import { createMemoryStorage } from './storage/memory.testing.ts';

const insertOrMergeLead = vi.fn();
const setTelegramMessage = vi.fn();
const sendLeadNotification = vi.fn();
const refreshLeadCard = vi.fn();

const realStore = createLeadStore({
  storage: createMemoryStorage(),
  schema: storedLeadSchema,
});

const store = {
  newStoredLead: realStore.newStoredLead,
  insertOrMergeLead,
  setTelegramMessage,
};

const notifier = { sendLeadNotification, refreshLeadCard };

const notifyLead = createNotifyLead({ store, notifier, brand: 'Test' });

const baseData: LeadInput = {
  brand: 'Test',
  name: 'Иван',
  contact: '@ivan',
  service: 'vehicle-sourcing',
  locale: 'ru',
};

const storedLead: StoredLead = {
  ...baseData,
  services: [],
  id: 42,
  status: 'new',
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
  adSource: null,
  metaIds: null,
  metaLeadSentAt: null,
  remindAt: null,
  postponedFrom: null,
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
  refreshLeadCard.mockReset().mockResolvedValue(false);
});

describe('notifyLead', () => {
  it('inserts into the store, then notifies Telegram with the id-assigned lead', async () => {
    await notifyLead(baseData, '[test]');
    expect(insertOrMergeLead).toHaveBeenCalledWith(baseData);
    expect(sendLeadNotification).toHaveBeenCalledWith(storedLead);
  });

  it('stores a lead handed to a sister brand under that brand and its rate', async () => {
    await notifyLead(baseData, '[test]', {
      brand: 'Details',
    });
    expect(insertOrMergeLead).toHaveBeenCalledWith({
      ...baseData,
      brand: 'Details',
    });
  });

  it('persists the telegram message id after a successful notification', async () => {
    await notifyLead(baseData, '[test]');
    expect(setTelegramMessage).toHaveBeenCalledWith(42, -100, 999);
  });

  it('does not throw when sendLeadNotification fails', async () => {
    vi.mocked(sendLeadNotification).mockRejectedValueOnce(new Error('TG down'));
    await expect(notifyLead(baseData, '[test]')).resolves.toEqual({
      stored: true,
      delivered: false,
    });
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
    refreshLeadCard.mockResolvedValueOnce(true);

    await notifyLead(baseData, '[test]');

    expect(sendLeadNotification).not.toHaveBeenCalled();
    expect(setTelegramMessage).not.toHaveBeenCalled();
    expect(refreshLeadCard).toHaveBeenCalledWith(merged);
  });

  it('posts nothing when a repeat submission merges into a lead that has no card', async () => {
    vi.mocked(insertOrMergeLead).mockResolvedValueOnce({
      lead: storedLead,
      merged: true,
    });

    await notifyLead(baseData, '[test]');

    expect(sendLeadNotification).not.toHaveBeenCalled();
  });
});

describe('notifyLead — delivery result', () => {
  it('reports a stored lead with a posted card', async () => {
    expect(await notifyLead(baseData, '[test]')).toEqual({
      stored: true,
      delivered: true,
    });
  });

  it('reports a card posted without CRM tracking when the store is down', async () => {
    vi.mocked(insertOrMergeLead).mockRejectedValueOnce(new Error('blob down'));

    expect(await notifyLead(baseData, '[test]')).toEqual({
      stored: false,
      delivered: true,
    });
  });

  it('reports nothing stored and nothing posted when the store and Telegram both fail', async () => {
    vi.mocked(insertOrMergeLead).mockRejectedValueOnce(new Error('blob down'));
    vi.mocked(sendLeadNotification).mockRejectedValueOnce(new Error('TG down'));

    expect(await notifyLead(baseData, '[test]')).toEqual({
      stored: false,
      delivered: false,
    });
  });

  it('reports a merged lead as delivered once its card is refreshed', async () => {
    vi.mocked(insertOrMergeLead).mockResolvedValueOnce({
      lead: { ...storedLead, telegramChatId: -100, telegramMessageId: 999 },
      merged: true,
    });

    expect(await notifyLead(baseData, '[test]')).toEqual({
      stored: true,
      delivered: true,
    });
  });

  it('still counts the card as delivered when only its id could not be kept', async () => {
    vi.mocked(setTelegramMessage).mockRejectedValueOnce(new Error('blob down'));

    expect(await notifyLead(baseData, '[test]')).toEqual({
      stored: true,
      delivered: true,
    });
  });
});

describe('ensureLeadCard', () => {
  const ensureLeadCard = createEnsureLeadCard({ store, notifier });

  it('edits the existing card and posts nothing new', async () => {
    refreshLeadCard.mockResolvedValueOnce(true);
    await ensureLeadCard(storedLead);

    expect(refreshLeadCard).toHaveBeenCalledWith(storedLead);
    expect(sendLeadNotification).not.toHaveBeenCalled();
    expect(setTelegramMessage).not.toHaveBeenCalled();
  });

  it('posts a replacement card and stores its id when there is nothing left to edit', async () => {
    await ensureLeadCard(storedLead);

    expect(sendLeadNotification).toHaveBeenCalledWith(storedLead);
    expect(setTelegramMessage).toHaveBeenCalledWith(42, -100, 999);
  });

  it('leaves a lost lead without a card — deleting it is how it was retired', async () => {
    await ensureLeadCard({ ...storedLead, status: 'lost' });

    expect(sendLeadNotification).not.toHaveBeenCalled();
  });

  it('keeps the posted card when its id cannot be stored', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setTelegramMessage.mockRejectedValueOnce(new Error('storage down'));

    await expect(ensureLeadCard(storedLead)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      '[lead-crm] failed to persist the group card id',
      expect.objectContaining({ leadId: 42 }),
    );
    errorSpy.mockRestore();
  });

  it('reports a lead row that vanished before its card id could be stored', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setTelegramMessage.mockResolvedValueOnce(undefined);

    await ensureLeadCard(storedLead);

    expect(errorSpy).toHaveBeenCalledWith(
      '[lead-crm] no lead row to attach the group card to',
      expect.objectContaining({ leadId: 42 }),
    );
    errorSpy.mockRestore();
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

    await expect(notifyLead(baseData, '[test]')).resolves.toEqual({
      stored: true,
      delivered: true,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "[test] failed to refresh the merged lead's card",
      expect.objectContaining({ leadId: 42 }),
    );
    errorSpy.mockRestore();
  });

  it('keeps the lead when persisting the Telegram message id fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setTelegramMessage.mockRejectedValue(new Error('storage down'));

    await expect(notifyLead(baseData, '[test]')).resolves.toEqual({
      stored: true,
      delivered: true,
    });

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
      notifyLead({ ...baseData, name: 42 as unknown as string }, '[test]'),
    ).resolves.toEqual({ stored: false, delivered: false });

    expect(errorSpy).toHaveBeenCalledWith(
      '[test] lead failed validation, cannot notify',
      expect.objectContaining({ brand: 'Test', service: 'vehicle-sourcing' }),
    );
    expect(sendLeadNotification).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('notifyLead — what reaches the logs', () => {
  it('never logs a name, a contact or a comment', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    insertOrMergeLead.mockRejectedValue(new Error('storage down'));
    sendLeadNotification.mockRejectedValue(new Error('telegram down'));

    await notifyLead(
      { ...baseData, comment: 'ГРМ на Octavia, тел. +381601234567' },
      '[test]',
    );

    const logged = JSON.stringify([logSpy.mock.calls, errorSpy.mock.calls]);
    for (const secret of ['Иван', '@ivan', 'Octavia', '+381601234567']) {
      expect(logged).not.toContain(secret);
    }
    expect(logged).toContain('vehicle-sourcing');
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('afterStatusChange', () => {
  const calls: string[] = [];
  const record = (name: string) => async (lead: StoredLead) => {
    calls.push(`${name}:${lead.id}`);
  };
  const afterStatusChange = createAfterStatusChange({
    ensureLeadCard: async (lead) => {
      calls.push(`card:${lead.id}`);
    },
    ensureLeadTopic: async (lead) => {
      calls.push(`summary:${lead.id}`);
      if (lead.name === 'broken') throw new Error('telegram down');
      return { ...lead, topicMessageId: 99 };
    },
    closeLeadTopic: async (lead) => {
      calls.push(`topic:${lead.id}:${lead.topicMessageId}`);
      return true;
    },
    notifier: {
      editLeadDetailMessage: async (chatId, messageId, lead, role) => {
        calls.push(`dm:${chatId}:${messageId}:${lead.id}:${role}`);
      },
      sendStatusChange: async (lead, by, authorId) => {
        calls.push(`status:${lead.id}:${by}:${authorId}`);
      },
      unpinLeadCard: record('unpin'),
    },
    dropFromDigest: async (leadId) => {
      calls.push(`digest:${leadId}`);
    },
  });

  beforeEach(() => {
    calls.length = 0;
  });

  const surface = { chatId: 7, messageId: 8, role: 'owner' as const };
  const author = { role: 'admin' as const, id: 222 };

  it.each([
    [
      'a plain change',
      { status: 'new' as const },
      { author },
      ['card:42', 'status:42:admin:222', 'digest:42'],
    ],
    [
      'a change from a DM',
      { status: 'lost' as const },
      { surface, author },
      [
        'card:42',
        'unpin:42',
        'topic:42:null',
        'dm:7:8:42:owner',
        'status:42:admin:222',
        'digest:42',
      ],
    ],
    [
      'won',
      { status: 'won' as const },
      { author },
      [
        'card:42',
        'unpin:42',
        'topic:42:null',
        'status:42:admin:222',
        'digest:42',
      ],
    ],
    [
      'a Lead with a topic',
      { status: 'won' as const, topicId: 5 },
      {},
      ['card:42', 'summary:42', 'unpin:42', 'topic:42:99'],
    ],
    [
      'a topic whose summary could not be refreshed',
      { status: 'negotiations' as const, topicId: 5, name: 'broken' },
      {},
      ['card:42', 'summary:42'],
    ],
    [
      'the ghost sweep',
      { status: 'lost' as const },
      undefined,
      ['card:42', 'unpin:42', 'topic:42:null'],
    ],
  ])('%s', async (_, patch, options, expected) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await afterStatusChange({ ...storedLead, ...patch }, options);

    expect(calls).toEqual(expected);
    error.mockRestore();
  });
});

describe('dropFromDigest', () => {
  const editDigest = vi.fn();
  const digestStore = createLeadStore({
    storage: createMemoryStorage(),
    schema: storedLeadSchema,
  });
  const dropFromDigest = createDropFromDigest({
    store: digestStore,
    notifier: { editDigest },
  });

  beforeEach(() => editDigest.mockReset());

  it('redraws the digest without the Lead, dropping Leads closed meanwhile', async () => {
    const [a, b, c] = [
      await digestStore.insertLead(baseData),
      await digestStore.insertLead(baseData),
      await digestStore.insertLead(baseData),
    ];
    await digestStore.setStatus(c!.id, 'won');
    const now = new Date();
    await digestStore.claimDigest(new Date(now.getTime() + 8 * 86_400_000));
    await digestStore.recordDigestMessage(
      new Date(now.getTime() + 8 * 86_400_000),
      { messageId: 77, due: [a!.id], stale: [b!.id, c!.id], hidden: 1 },
    );

    await dropFromDigest(a!.id);

    expect(editDigest).toHaveBeenCalledExactlyOnceWith(
      77,
      { due: [], stale: [expect.objectContaining({ id: b!.id })] },
      1,
    );
  });

  it('survives a digest message that can no longer be edited', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const dropFromGoneDigest = createDropFromDigest({
      store: digestStore,
      notifier: {
        editDigest: async () => {
          throw new Error('message to edit not found');
        },
      },
    });
    const lead = await digestStore.insertLead(baseData);
    const later = new Date(Date.now() + 16 * 86_400_000);
    await digestStore.claimDigest(later);
    await digestStore.recordDigestMessage(later, {
      messageId: 78,
      due: [],
      stale: [lead.id],
      hidden: 0,
    });

    await expect(dropFromGoneDigest(lead.id)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('edits nothing for a Lead the digest does not show', async () => {
    await dropFromDigest(999);
    expect(editDigest).not.toHaveBeenCalled();
  });
});

describe('ensureLeadTopic', () => {
  const openLeadTopic = vi.fn();
  const postLeadTopicSummary = vi.fn();
  const refreshLeadTopic = vi.fn();
  const deleteLeadTopic = vi.fn();
  const topicStore = createLeadStore({
    storage: createMemoryStorage(),
    schema: storedLeadSchema,
  });
  const ensureLeadTopic = createEnsureLeadTopic({
    store: topicStore,
    notifier: {
      openLeadTopic,
      deleteLeadTopic,
      postLeadTopicSummary,
      refreshLeadTopic,
    },
  });

  beforeEach(() => {
    openLeadTopic.mockReset().mockResolvedValue(5);
    postLeadTopicSummary.mockReset().mockResolvedValue(77);
    refreshLeadTopic.mockReset().mockResolvedValue(undefined);
    deleteLeadTopic.mockReset().mockResolvedValue(undefined);
  });

  it('opens no topic for a Lead the bot never saw', async () => {
    const lead = await topicStore.insertLead(baseData);
    await expect(ensureLeadTopic(lead)).resolves.toBe(lead);
    expect(openLeadTopic).not.toHaveBeenCalled();
  });

  it('opens one topic and stores it, then only edits the summary', async () => {
    const lead = await topicStore.insertLead({ ...baseData, telegramId: 9 });
    const opened = await ensureLeadTopic(lead);
    expect(opened).toMatchObject({ topicId: 5, topicMessageId: 77 });
    expect(await topicStore.getLead(lead.id)).toMatchObject({
      topicId: 5,
      topicMessageId: 77,
    });
    await expect(ensureLeadTopic(opened)).resolves.toBe(opened);
    expect(openLeadTopic).toHaveBeenCalledOnce();
    expect(refreshLeadTopic).toHaveBeenCalledWith(opened);
  });

  it('keeps a topic whose summary failed, and posts the summary next time', async () => {
    const lead = await topicStore.insertLead({ ...baseData, telegramId: 9 });
    postLeadTopicSummary.mockRejectedValueOnce(new Error('telegram down'));

    await expect(ensureLeadTopic(lead)).rejects.toThrow('telegram down');
    const orphan = (await topicStore.getLead(lead.id))!;
    expect(orphan).toMatchObject({ topicId: 5, topicMessageId: null });

    await expect(ensureLeadTopic(orphan)).resolves.toMatchObject({
      topicId: 5,
      topicMessageId: 77,
    });
    expect(openLeadTopic).toHaveBeenCalledOnce();
    expect(postLeadTopicSummary).toHaveBeenLastCalledWith(orphan, 5);
    expect(refreshLeadTopic).not.toHaveBeenCalled();
  });

  it('deletes the topic it lost a race for and keeps the first one', async () => {
    const lead = await topicStore.insertLead({ ...baseData, telegramId: 9 });
    await topicStore.setTopic(lead.id, 4);

    await expect(ensureLeadTopic(lead)).resolves.toMatchObject({
      topicId: 4,
      topicMessageId: null,
    });
    expect(deleteLeadTopic).toHaveBeenCalledWith(5);
    expect(postLeadTopicSummary).not.toHaveBeenCalled();
  });

  it('logs a duplicate topic it could not delete', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const lead = await topicStore.insertLead({ ...baseData, telegramId: 9 });
    await topicStore.setTopic(lead.id, 4);
    deleteLeadTopic.mockRejectedValueOnce(new Error('no rights'));

    await expect(ensureLeadTopic(lead)).resolves.toMatchObject({ topicId: 4 });
    expect(error).toHaveBeenCalledWith(
      '[lead-crm] could not delete a duplicate topic',
      expect.objectContaining({ leadId: lead.id, topicId: 5 }),
    );
    error.mockRestore();
  });

  it('hands back the Lead when its row is gone', async () => {
    const lead = { ...storedLead, id: 999, telegramId: 9 };
    await expect(ensureLeadTopic(lead)).resolves.toBe(lead);
    const topical = { ...lead, topicId: 5 };
    await expect(ensureLeadTopic(topical)).resolves.toBe(topical);
  });
});
