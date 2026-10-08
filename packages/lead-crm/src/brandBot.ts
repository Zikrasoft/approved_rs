import { z } from 'zod';
import {
  createAfterStatusChange,
  createEnsureLeadCard,
  createNotifyLead,
} from './notifyLead.ts';
import type { LeadStore } from './store.ts';
import { createTelegramClient, parseIds } from './telegram/client.ts';
import { createFormatter } from './telegram/format.ts';
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
  replyRelayBrands?: readonly string[];
}

export function createBrandBot({
  store,
  brand,
  serviceLabel,
  replyRelayBrands,
}: BrandBotOptions) {
  const env = readBotEnv();
  const ownerIds = env.TELEGRAM_OWNER_ID;
  const adminIds = env.TELEGRAM_ADMIN_ID;
  const client = createTelegramClient(env.TELEGRAM_BOT_TOKEN);
  const formatter = createFormatter({
    serviceLabel,
    botUsername: env.TELEGRAM_BOT_USERNAME,
    replyRelayBrands,
  });
  const notifier = createNotifier({
    client,
    formatter,
    groupId: env.TELEGRAM_GROUP_ID,
    ownerIds,
    adminIds,
  });
  const ensureLeadCard = createEnsureLeadCard({ store, notifier });
  return {
    notifier,
    ensureLeadCard,
    afterStatusChange: createAfterStatusChange({ ensureLeadCard, notifier }),
    notifyLead: createNotifyLead({ store, notifier, brand }),
    client,
    formatter,
    ownerIds,
    adminIds,
  };
}
