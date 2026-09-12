import {
  createFormatter,
  createNotifier,
  createNotifyLead,
  createTelegramClient,
  parseIds,
  type TrackedContactChannel,
} from '@podbor/lead-crm';
import { getServicesContent } from '@/i18n/content/services';
import { isServiceSlug } from '@/utils/services';
import { BRAND, DEFAULT_COMMISSION_PERCENT, leadStore } from './crm';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[telegram] ${name} is not set`);
  return value;
}

const ruServices = getServicesContent('ru');

export const OWNER_IDS = parseIds(process.env.TELEGRAM_OWNER_ID);
export const ADMIN_IDS = parseIds(process.env.TELEGRAM_ADMIN_ID);

export const client = createTelegramClient(requireEnv('TELEGRAM_BOT_TOKEN'));

export const formatter = createFormatter({
  serviceLabel: (slug) => (isServiceSlug(slug) ? ruServices[slug].name : slug),
  botUsername: requireEnv('TELEGRAM_BOT_USERNAME'),
  defaultCommissionPercent: DEFAULT_COMMISSION_PERCENT,
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

export const notifyLead = createNotifyLead({
  store: leadStore,
  notifier,
  brand: BRAND,
});
