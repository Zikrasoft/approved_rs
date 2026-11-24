import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBrandStore } from './brandStore.ts';
import { createBrandBot } from './brandBot.ts';
import { recordBotApi } from './testing/botApi.ts';
import { crmDatabase } from './database.ts';
import { leadData } from './leadRow.ts';
import { seedLead, testLeadId } from './testing/seed.ts';

const ENV = {
  TELEGRAM_BOT_TOKEN: '3001:token',
  TELEGRAM_BOT_USERNAME: 'crm_bot',
  TELEGRAM_GROUP_ID: '-100',
  TELEGRAM_OWNER_ID: '1,2',
  TELEGRAM_ADMIN_ID: '3',
};

const submission = {
  name: 'Иван',
  contact: '@ivan',
  service: 'vehicle-sourcing',
  locale: 'ru' as const,
};

function brandStore(getNotifier = vi.fn()) {
  return createBrandStore({
    brand: 'CarLab',
    getNotifier,
  });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  for (const name of Object.keys(ENV)) vi.stubEnv(name, '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createBrandStore', () => {
  it('builds without any Telegram env', () => {
    expect(() => brandStore()).not.toThrow();
  });

  it('keeps a standalone service the app names in a Lead of its own', async () => {
    const { leadStore } = createBrandStore({
      brand: 'CarLab',
      getNotifier: vi.fn(),
      standaloneServices: ['parts-order'],
    });
    const lead = {
      ...submission,
      brand: 'CarLab',
      contact: '+381601111111',
      visitorId: 'visitor-1',
    };
    await leadStore.insertOrMergeLead(lead);
    const { merged } = await leadStore.insertOrMergeLead({
      ...lead,
      service: 'parts-order',
    });

    expect(merged).toBe(false);
  });

  it(
    'alerts through the notifier once the stored Leads reach a threshold',
    { timeout: 30_000 },
    async () => {
      const send = vi.fn().mockResolvedValue(undefined);
      const { leadStore } = brandStore(
        vi.fn().mockResolvedValue({ notifier: { sendLeadCountAlert: send } }),
      );
      const seed = await seedLead({ brand: 'CarLab', status: 'won' });
      await crmDatabase().lead.createMany({
        data: Array.from({ length: 4998 }, (_, at) =>
          leadData({
            ...seed,
            id: undefined,
            number: null,
            contact: `@seed${at}`,
          }),
        ),
      });

      await leadStore.insertOrMergeLead({ ...submission, brand: 'CarLab' });

      expect(send).toHaveBeenCalledWith(5000, 'CarLab');
    },
  );

  it('stamps its own brand over whatever the submission carries, and posts the card', async () => {
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
    const api = recordBotApi();
    vi.stubGlobal('fetch', api.fetch);
    const { leadStore, notifyLead } = brandStore(
      vi.fn(async () =>
        createBrandBot({ store: leadStore, serviceLabel: (slug) => slug }),
      ),
    );
    const forged = { ...submission, brand: 'Approved.rs' };

    const result = await notifyLead(forged, '[test]');

    expect(result).toEqual({ stored: true, delivered: true });
    const [lead] = await leadStore.readLeads();
    expect(lead?.brand).toBe('CarLab');
    expect(api.callsTo('sendMessage', ENV.TELEGRAM_BOT_TOKEN)).toHaveLength(1);
  });

  it('stores the Lead even when the bot cannot load', async () => {
    const { leadStore, notifyLead } = brandStore(
      vi
        .fn()
        .mockRejectedValue(
          new Error('[telegram] TELEGRAM_BOT_TOKEN is not set'),
        ),
    );

    const result = await notifyLead(submission, '[test]');

    expect(result).toEqual({ stored: true, delivered: false });
    expect(await leadStore.readLeads()).toEqual([
      expect.objectContaining({ contact: '@ivan', brand: 'CarLab' }),
    ]);
  });

  it('refreshes the card of a merged Lead through the bot it loads', async () => {
    const refreshLeadCard = vi.fn().mockResolvedValue(undefined);
    const { notifyLead } = brandStore(
      vi.fn().mockResolvedValue({ notifier: { refreshLeadCard } }),
    );
    const click = { ...submission, visitorId: 'visitor-1' };

    await notifyLead({ ...click, contact: '—', name: '' }, '[test]');
    await notifyLead(click, '[test]');

    expect(refreshLeadCard).toHaveBeenCalledOnce();
  });
});

describe('createBrandBot', () => {
  function bot() {
    const { leadStore } = brandStore();
    return {
      leadStore,
      bot: createBrandBot({
        store: leadStore,
        serviceLabel: (slug) => slug,
      }),
    };
  }

  it.each(['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'TELEGRAM_GROUP_ID'])(
    'names %s when it is missing',
    (missing) => {
      for (const [name, value] of Object.entries(ENV))
        if (name !== missing) vi.stubEnv(name, value);

      expect(bot).toThrow(`${missing} is not set`);
    },
  );

  it.each(['TELEGRAM_OWNER_ID', 'TELEGRAM_ADMIN_ID'])(
    'names %s when it holds something other than ids',
    (garbled) => {
      for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
      vi.stubEnv(garbled, '1,abc');

      expect(bot).toThrow(`${garbled} must be comma-separated Telegram ids`);
    },
  );

  it('reads no ids from an unset owner or admin variable', () => {
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
    vi.stubEnv('TELEGRAM_OWNER_ID', undefined);
    vi.stubEnv('TELEGRAM_ADMIN_ID', '');

    const { ownerIds, adminIds } = bot().bot;

    expect(ownerIds).toEqual([]);
    expect(adminIds).toEqual([]);
  });

  it('reads the group, owner and admin ids', () => {
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);

    const { groupId, ownerIds, adminIds } = bot().bot;

    expect(groupId).toBe(ENV.TELEGRAM_GROUP_ID);
    expect(ownerIds).toEqual([1, 2]);
    expect(adminIds).toEqual([3]);
  });
});

describe('the Lead topic lifecycle', () => {
  let api: ReturnType<typeof recordBotApi>;

  async function withTopic() {
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
    api = recordBotApi();
    vi.stubGlobal('fetch', api.fetch);
    const { leadStore } = brandStore();
    const crm = createBrandBot({
      store: leadStore,
      serviceLabel: (slug) => slug,
    });
    const lead = await leadStore.insertLead({
      ...submission,
      brand: 'CarLab',
      telegramId: 9,
    });
    const topical = await crm.ensureLeadTopic(lead);
    api.reset();
    return { leadStore, crm, lead: topical };
  }

  it('opens a topic with nothing in it and closes it once when the Lead is won', async () => {
    const { leadStore, crm, lead } = await withTopic();
    expect(lead).toMatchObject({ topicClosed: false, topicActiveAt: null });

    const won = await leadStore.setStatus(lead.id, 'won');
    await crm.afterStatusChange(won!);
    await crm.afterStatusChange((await leadStore.getLead(lead.id))!);

    expect(api.callsTo('closeForumTopic')).toEqual([
      expect.objectContaining({
        payload: { chat_id: '-100', message_thread_id: lead.topicId },
      }),
    ]);
    expect(await leadStore.getLead(lead.id)).toMatchObject({
      topicClosed: true,
    });
  });

  it('refreshes the topic summary with the new status', async () => {
    const { leadStore, crm, lead } = await withTopic();

    const won = await leadStore.setStatus(lead.id, 'won');
    await crm.afterStatusChange(won!);

    expect(api.callsTo('editMessageText')).toContainEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          message_id: lead.topicMessageId,
          text: expect.stringContaining('✅ Успешно'),
        }),
      }),
    );
  });

  it('keeps the topic open in the store when Telegram would not close it, and carries on', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { leadStore, crm, lead } = await withTopic();
    api.fail('closeForumTopic', 'Bad Request: not enough rights');

    const lost = await leadStore.setStatus(lead.id, 'lost');
    await expect(crm.afterStatusChange(lost!)).resolves.toBeUndefined();
    expect(await leadStore.getLead(lead.id)).toMatchObject({
      topicClosed: false,
    });
    await expect(crm.closeLeadTopic(lost!)).resolves.toBe(false);
    error.mockRestore();
  });

  it.each(['postponed', 'negotiations'] as const)(
    'leaves the topic open on %s',
    async (status) => {
      const { leadStore, crm, lead } = await withTopic();

      await crm.afterStatusChange(
        (await leadStore.setStatus(lead.id, status))!,
      );

      expect(api.callsTo('closeForumTopic')).toEqual([]);
    },
  );

  it('closes a topic Telegram already reports closed without failing', async () => {
    const { leadStore, crm, lead } = await withTopic();
    api.fail('closeForumTopic', 'Bad Request: TOPIC_NOT_MODIFIED');

    const lost = await leadStore.setStatus(lead.id, 'lost');
    await expect(crm.afterStatusChange(lost!)).resolves.toBeUndefined();
  });

  it('reopens a closed topic and stamps the activity', async () => {
    vi.useFakeTimers({
      toFake: ['Date'],
      now: new Date('2026-10-20T08:00:00.000Z'),
    });
    const { leadStore, crm, lead } = await withTopic();
    const closed = await leadStore.closeTopic(lead.id);

    const touched = await crm.touchLeadTopic(closed!);

    expect(api.callsTo('reopenForumTopic')).toEqual([
      expect.objectContaining({
        payload: { chat_id: '-100', message_thread_id: lead.topicId },
      }),
    ]);
    expect(touched).toMatchObject({
      topicClosed: false,
      topicActiveAt: '2026-10-20T08:00:00.000Z',
    });
  });

  it('only stamps an open topic, and leaves a topicless Lead alone', async () => {
    const { crm, lead } = await withTopic();

    await crm.touchLeadTopic(lead);
    const bare = { ...lead, topicId: null };

    await expect(crm.touchLeadTopic(bare)).resolves.toBe(bare);
    expect(api.callsTo('reopenForumTopic')).toEqual([]);
  });

  it('tolerates a topic Telegram already reports open', async () => {
    const { leadStore, crm, lead } = await withTopic();
    api.fail('reopenForumTopic', 'Bad Request: TOPIC_NOT_MODIFIED');

    const touched = await crm.touchLeadTopic(
      (await leadStore.closeTopic(lead.id))!,
    );

    expect(touched.topicClosed).toBe(false);
  });

  it('keeps the topic marked closed when it could not be reopened', async () => {
    const { leadStore, crm, lead } = await withTopic();
    api.fail('reopenForumTopic', 'Bad Request: not enough rights');
    const closed = (await leadStore.closeTopic(lead.id))!;

    await expect(crm.touchLeadTopic(closed)).resolves.toBe(closed);
    expect(await leadStore.getLead(lead.id)).toMatchObject({
      topicClosed: true,
    });
  });

  it('hands back the Lead when its row is gone', async () => {
    const { crm, lead } = await withTopic();
    const gone = { ...lead, id: testLeadId(999) };

    await expect(crm.touchLeadTopic(gone)).resolves.toBe(gone);
  });

  it('asks Telegram nothing for a topicless Lead', async () => {
    const { crm, lead } = await withTopic();

    await crm.notifier.closeLeadTopic({ ...lead, topicId: null });
    await crm.notifier.reopenLeadTopic({ ...lead, topicId: null });

    expect(api.calls).toEqual([]);
  });

  it('still fails on a Bot API error that is not about the topic state', async () => {
    const { crm, lead } = await withTopic();
    api.fail('closeForumTopic', 'Bad Request: not enough rights');

    await expect(crm.notifier.closeLeadTopic(lead)).rejects.toThrow(
      'not enough rights',
    );
  });
});
