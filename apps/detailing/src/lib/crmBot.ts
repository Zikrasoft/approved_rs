import {
  createEnsureLeadCard,
  createFormatter,
  createNotifier,
  createNotifyLead,
  createTelegramClient,
  parseIds,
  requireEnv,
} from '@podbor/lead-crm';
import { serviceLabel as brandServiceLabel } from '@podbor/brands';
import { content } from '@/i18n/content';
import { isServiceSlug } from '@/utils/services';
import { BRAND, leadStore } from './crm';

const ruServices = content('ru').services;

const OWNER_IDS = parseIds(process.env.TELEGRAM_OWNER_ID);
const ADMIN_IDS = parseIds(process.env.TELEGRAM_ADMIN_ID);

const client = createTelegramClient(requireEnv('TELEGRAM_BOT_TOKEN'));

const formatter = createFormatter({
  serviceLabel: (slug) =>
    isServiceSlug(slug) ? ruServices[slug].name : brandServiceLabel(slug),
  botUsername: requireEnv('TELEGRAM_BOT_USERNAME'),
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
