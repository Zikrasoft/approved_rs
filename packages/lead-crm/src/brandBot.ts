import { z } from 'zod';
import {
  createAfterStatusChange,
  createDropFromDigest,
  createCloseLeadTopic,
  createEnsureLeadCard,
  createEnsureLeadTopic,
  createNotifyLead,
  createTouchLeadTopic,
} from './notifyLead.ts';
import type { LeadStore } from './store.ts';
import { createTelegramClient } from './telegram/client.ts';
import { createFormatter } from './telegram/cards.ts';
import { createNotifier } from './telegram/notify.ts';
import { createShopOrders } from './shopOrders.ts';

const required = (name: string) =>
  z.string({ error: `[telegram] ${name} is not set` }).min(1, {
    error: `[telegram] ${name} is not set`,
  });
const ids = (name: string) => {
  const error = `[telegram] ${name} must be comma-separated Telegram ids`;
  return z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.coerce.number<string>({ error }).int({ error })));
};
const optional = z
  .string()
  .optional()
  .transform((value) => value || undefined);

const BotEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: required('TELEGRAM_BOT_TOKEN'),
  TELEGRAM_BOT_USERNAME: required('TELEGRAM_BOT_USERNAME'),
  TELEGRAM_GROUP_ID: required('TELEGRAM_GROUP_ID'),
  TELEGRAM_OWNER_ID: ids('TELEGRAM_OWNER_ID'),
  TELEGRAM_ADMIN_ID: ids('TELEGRAM_ADMIN_ID'),
  SHOP_API_URL: optional.pipe(z.url().optional()),
  SHOP_ORDER_OUTCOME_SECRET: optional,
});

function readBotEnv() {
  const env = BotEnvSchema.safeParse(process.env);
  if (!env.success)
    throw new Error(env.error.issues.map((issue) => issue.message).join('; '));
  return env.data;
}

export type CancelOrderResult = 'lost' | 'won' | 'missing';

export interface BrandBotOptions {
  store: LeadStore;
  brand: string;
  serviceLabel: (slug: string) => string;
}

export function createBrandBot({
  store,
  brand,
  serviceLabel,
}: BrandBotOptions) {
  const env = readBotEnv();
  const ownerIds = env.TELEGRAM_OWNER_ID;
  const adminIds = env.TELEGRAM_ADMIN_ID;
  const client = createTelegramClient(
    env.TELEGRAM_BOT_TOKEN,
    env.TELEGRAM_BOT_USERNAME,
  );
  const formatter = createFormatter({
    serviceLabel,
    botUsername: env.TELEGRAM_BOT_USERNAME,
    groupId: env.TELEGRAM_GROUP_ID,
  });
  const notifier = createNotifier({
    client,
    formatter,
    groupId: env.TELEGRAM_GROUP_ID,
    ownerIds,
    adminIds,
  });
  const ensureLeadCard = createEnsureLeadCard({ store, notifier });
  const ensureLeadTopic = createEnsureLeadTopic({ store, notifier });
  const closeLeadTopic = createCloseLeadTopic({ store, notifier });
  const dropFromDigest = createDropFromDigest({ store, notifier });
  const { settleOrder, settlePendingOrders, recordConflict } = createShopOrders(
    {
      store,
      notifier,
      shopUrl: env.SHOP_API_URL,
      secret: env.SHOP_ORDER_OUTCOME_SECRET,
    },
  );
  const afterStatusChange = createAfterStatusChange({
    ensureLeadCard,
    ensureLeadTopic,
    closeLeadTopic,
    notifier,
    dropFromDigest,
    settleOrder,
  });

  async function cancelOrderLead(orderId: string): Promise<CancelOrderResult> {
    const before = (await store.readLeads()).find(
      (lead) => lead.orderId === orderId,
    );
    if (!before) return 'missing';
    const lost = await store.loseOrderLead(orderId);
    if (!lost) {
      await recordConflict({ ...before, orderId, status: 'won' });
      return 'won';
    }
    if (before.status !== 'lost') await afterStatusChange(lost);
    return 'lost';
  }

  return {
    notifier,
    ensureLeadCard,
    ensureLeadTopic,
    touchLeadTopic: createTouchLeadTopic({ store, notifier }),
    closeLeadTopic,
    afterStatusChange,
    settlePendingOrders,
    cancelOrderLead,
    dropFromDigest,
    notifyLead: createNotifyLead({ store, notifier, brand }),
    client,
    formatter,
    groupId: env.TELEGRAM_GROUP_ID,
    ownerIds,
    adminIds,
  };
}
