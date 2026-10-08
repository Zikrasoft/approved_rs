import { createEnsureLeadCard, createNotifyLead } from './notifyLead.ts';
import { requireEnv } from './requireEnv.ts';
import type { LeadStore } from './store.ts';
import { createTelegramClient, parseIds } from './telegram/client.ts';
import { createFormatter } from './telegram/format.ts';
import { createNotifier } from './telegram/notify.ts';

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
  const ownerIds = parseIds(process.env.TELEGRAM_OWNER_ID);
  const adminIds = parseIds(process.env.TELEGRAM_ADMIN_ID);
  const client = createTelegramClient(requireEnv('TELEGRAM_BOT_TOKEN'));
  const formatter = createFormatter({
    serviceLabel,
    botUsername: requireEnv('TELEGRAM_BOT_USERNAME'),
    replyRelayBrands,
  });
  const notifier = createNotifier({
    client,
    formatter,
    groupId: requireEnv('TELEGRAM_GROUP_ID'),
    ownerIds,
    adminIds,
  });
  return {
    notifier,
    ensureLeadCard: createEnsureLeadCard({ store, notifier }),
    notifyLead: createNotifyLead({ store, notifier, brand }),
    client,
    formatter,
    ownerIds,
    adminIds,
  };
}
