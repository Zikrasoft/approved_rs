import { z } from 'zod';
import {
  createAfterStatusChange,
  createCloseLeadTopic,
  createEnsureLeadCard,
  createEnsureLeadTopic,
  createNotifyLead,
  createTouchLeadTopic,
} from './notifyLead.ts';
import type { LeadStore } from './store.ts';
import { createTelegramClient, parseIds } from './telegram/client.ts';
import { createFormatter } from './telegram/cards.ts';
import { createNotifier } from './telegram/notify.ts';

const required = (name: string) =>
  z.string({ error: `[telegram] ${name} is not set` }).min(1, {
    error: `[telegram] ${name} is not set`,
  });
const ids = z.string().optional().transform(parseIds);

const BotEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: required('TELEGRAM_BOT_TOKEN'),
  TELEGRAM_BOT_USERNAME: required('TELEGRAM_BOT_USERNAME'),
  TELEGRAM_GROUP_ID: required('TELEGRAM_GROUP_ID'),
  TELEGRAM_OWNER_ID: ids,
  TELEGRAM_ADMIN_ID: ids,
});

function readBotEnv() {
  const env = BotEnvSchema.safeParse(process.env);
  if (!env.success)
    throw new Error(env.error.issues.map((issue) => issue.message).join('; '));
  return env.data;
}

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
  return {
    notifier,
    ensureLeadCard,
    ensureLeadTopic,
    touchLeadTopic: createTouchLeadTopic({ store, notifier }),
    closeLeadTopic,
    afterStatusChange: createAfterStatusChange({
      ensureLeadCard,
      ensureLeadTopic,
      closeLeadTopic,
      notifier,
    }),
    notifyLead: createNotifyLead({ store, notifier, brand }),
    client,
    formatter,
    groupId: env.TELEGRAM_GROUP_ID,
    ownerIds,
    adminIds,
  };
}
