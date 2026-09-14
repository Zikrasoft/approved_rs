import {
  createEnsureLeadCard,
  createFormatter,
  createNotifier,
  createNotifyLead,
  createTelegramClient,
  parseIds,
} from '@podbor/lead-crm';
import { serviceLabel } from '@podbor/brands';
import type { TrackedContactChannel } from '@/utils/contactChannel';
import { BRAND, leadStore } from './crm';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[telegram] ${name} is not set`);
  return value;
}

export const OWNER_IDS = parseIds(process.env.TELEGRAM_OWNER_ID);
export const ADMIN_IDS = parseIds(process.env.TELEGRAM_ADMIN_ID);

export const client = createTelegramClient(requireEnv('TELEGRAM_BOT_TOKEN'));

export const formatter = createFormatter({
  serviceLabel,
  botUsername: requireEnv('TELEGRAM_BOT_USERNAME'),
  contactChannelLabels: {
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    viber: 'Viber',
    phone: 'звонок',
  } satisfies Record<TrackedContactChannel, string>,
});

export const notifier = createNotifier({
  client,
  formatter,
  groupId: requireEnv('TELEGRAM_GROUP_ID'),
  ownerIds: OWNER_IDS,
  adminIds: ADMIN_IDS,
});

export const ensureLeadCard = createEnsureLeadCard({
  store: leadStore,
  notifier,
});

export const notifyLead = createNotifyLead({
  store: leadStore,
  notifier,
  brand: BRAND,
});
