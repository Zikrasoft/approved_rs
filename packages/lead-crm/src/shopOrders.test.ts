import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBrandStore } from './brandStore.ts';
import { createBrandBot } from './brandBot.ts';
import { recordBotApi } from './testing/botApi.ts';
import { createMemoryStorage } from './storage/memory.testing.ts';

const ENV = {
  TELEGRAM_BOT_TOKEN: '3001:token',
  TELEGRAM_BOT_USERNAME: 'crm_bot',
  TELEGRAM_GROUP_ID: '-100',
  TELEGRAM_OWNER_ID: '1',
  TELEGRAM_ADMIN_ID: '3',
  SHOP_ADMIN_URL: 'https://shop.carlab.rs',
  SHOP_ADMIN_API_KEY: 'sk_test',
};

const SHOP = 'https://shop.carlab.rs/';

const order = {
  name: 'Ana',
  contact: '+381601234567',
  service: 'parts-order',
  locale: 'sr',
  brand: 'CarLab',
  orderId: 'order_01',
};

let shopAnswers: number[];
let shopCalls: { url: string; init: RequestInit }[];
let api: ReturnType<typeof recordBotApi>;

function crm() {
  const storages = new Map<string, ReturnType<typeof createMemoryStorage>>();
  const { leadStore } = createBrandStore({
    brand: 'CarLab',
    storageFor: (path) => {
      if (!storages.has(path)) storages.set(path, createMemoryStorage());
      return storages.get(path)!;
    },
    getNotifier: vi.fn(),
  });
  const bot = createBrandBot({
    store: leadStore,
    brand: 'CarLab',
    serviceLabel: (slug) => slug,
  });
  return { leadStore, bot };
}

const outcomes = () =>
  shopCalls.map(({ url, init }) => [url, JSON.parse(String(init.body))]);

beforeEach(() => {
  for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  api = recordBotApi();
  shopAnswers = [];
  shopCalls = [];
  vi.stubGlobal(
    'fetch',
    async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input);
      if (!url.startsWith(SHOP)) return api.fetch(input, init);
      shopCalls.push({ url, init });
      const status = shopAnswers.shift() ?? 200;
      if (status === 0) throw new TypeError('fetch failed');
      return new Response('{}', { status });
    },
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('a shop Order decided in the CRM bot', () => {
  it('completes the Order when its Lead is won', async () => {
    const { leadStore, bot } = crm();
    const lead = await leadStore.insertLead(order);

    await bot.afterStatusChange((await leadStore.setStatus(lead.id, 'won'))!);

    expect(outcomes()).toEqual([
      [`${SHOP}admin/carlab-orders/order_01/outcome`, { outcome: 'completed' }],
    ]);
    expect(shopCalls[0]!.init.headers).toMatchObject({
      authorization: `Basic ${btoa('sk_test:')}`,
    });
    expect(await leadStore.getLead(lead.id)).toMatchObject({
      orderSettled: 'won',
    });
  });

  it('cancels the Order when its Lead is lost, and asks the shop only once', async () => {
    const { leadStore, bot } = crm();
    const lead = await leadStore.insertLead(order);

    await bot.afterStatusChange((await leadStore.setStatus(lead.id, 'lost'))!);
    await bot.afterStatusChange((await leadStore.getLead(lead.id))!);

    expect(outcomes()).toEqual([
      [`${SHOP}admin/carlab-orders/order_01/outcome`, { outcome: 'canceled' }],
    ]);
  });

  it('calls nothing for a Lead without an Order, or one still open', async () => {
    const { leadStore, bot } = crm();
    const plain = await leadStore.insertLead({ ...order, orderId: undefined });
    const open = await leadStore.insertLead({ ...order, orderId: 'order_02' });

    await bot.afterStatusChange((await leadStore.setStatus(plain.id, 'won'))!);
    await bot.afterStatusChange(
      (await leadStore.setStatus(open.id, 'negotiations'))!,
    );

    expect(shopCalls).toEqual([]);
  });

  it('retries an outcome the shop did not take until it does', async () => {
    const { leadStore, bot } = crm();
    const lead = await leadStore.insertLead(order);
    shopAnswers = [503, 0];

    await bot.afterStatusChange((await leadStore.setStatus(lead.id, 'won'))!);
    expect(await bot.settlePendingOrders()).toBe(1);
    expect((await leadStore.getLead(lead.id))?.orderSettled).toBeUndefined();
    expect(await bot.settlePendingOrders()).toBe(0);
    expect(await bot.settlePendingOrders()).toBe(0);

    expect(shopCalls).toHaveLength(3);
    expect(await leadStore.getLead(lead.id)).toMatchObject({
      orderSettled: 'won',
    });
  });

  it('stops asking once the shop already holds the other outcome', async () => {
    const { leadStore, bot } = crm();
    const lead = await leadStore.insertLead(order);
    shopAnswers = [409];

    await bot.afterStatusChange((await leadStore.setStatus(lead.id, 'lost'))!);

    expect(await bot.settlePendingOrders()).toBe(0);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('already holds'),
      expect.objectContaining({ orderId: 'order_01' }),
    );
  });

  it('keeps the outcome pending while no shop is configured', async () => {
    vi.stubEnv('SHOP_ADMIN_API_KEY', '');
    const { leadStore, bot } = crm();
    const lead = await leadStore.insertLead(order);

    await bot.afterStatusChange((await leadStore.setStatus(lead.id, 'won'))!);

    expect(shopCalls).toEqual([]);
    expect(await bot.settlePendingOrders()).toBe(1);
  });
});

describe('a shop Order cancelled in the shop admin', () => {
  it('marks its Lead lost and redraws its card, without asking the shop back', async () => {
    const { leadStore, bot } = crm();
    const lead = await leadStore.insertLead(order);
    await leadStore.setTelegramMessage(lead.id, -100, 55);

    await expect(bot.cancelOrderLead('order_01')).resolves.toBe(true);

    expect(await leadStore.getLead(lead.id)).toMatchObject({
      status: 'lost',
      orderSettled: 'lost',
    });
    expect(shopCalls).toEqual([]);
    expect(api.callsTo('editMessageText')).toContainEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ message_id: 55 }),
      }),
    );
  });

  it('resumes a postponed Lead into lost', async () => {
    const { leadStore, bot } = crm();
    const lead = await leadStore.insertLead(order);
    await leadStore.postponeLead(lead.id, '2030-01-01T00:00:00.000Z', 'later');

    await bot.cancelOrderLead('order_01');

    expect(await leadStore.getLead(lead.id)).toMatchObject({
      status: 'lost',
      remindAt: null,
      postponedFrom: null,
    });
  });

  it('settles a Lead already lost without touching it again', async () => {
    const { leadStore, bot } = crm();
    const lead = await leadStore.insertLead(order);
    shopAnswers = [503];
    await bot.afterStatusChange((await leadStore.setStatus(lead.id, 'lost'))!);
    const lost = await leadStore.getLead(lead.id);
    api.reset();

    await bot.cancelOrderLead('order_01');

    expect(await leadStore.getLead(lead.id)).toEqual({
      ...lost,
      orderSettled: 'lost',
    });
    expect(api.calls).toEqual([]);
  });

  it('leaves a won Lead won', async () => {
    const { leadStore, bot } = crm();
    const lead = await leadStore.insertLead(order);
    await leadStore.setStatus(lead.id, 'won');

    await expect(bot.cancelOrderLead('order_01')).resolves.toBe(true);

    expect(await leadStore.getLead(lead.id)).toMatchObject({ status: 'won' });
  });

  it('says so when no Lead carries the Order', async () => {
    const { bot } = crm();

    await expect(bot.cancelOrderLead('order_missing')).resolves.toBe(false);
  });
});
