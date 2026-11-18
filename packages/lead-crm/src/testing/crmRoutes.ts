import { vi } from 'vitest';
import { serviceLabel } from '@podbor/brands';
import { createLeadStore } from '../store.ts';
import { createLedgerStore } from '../ledgerStore.ts';
import { createBrandBot } from '../brandBot.ts';
import { createTelegramClient } from '../telegram/client.ts';
import { createCrmWebhookRoute } from '../routes/crmWebhook.ts';
import { createRemindersRoute } from '../routes/reminders.ts';

export const CRM_TOKEN = '1001:test-bot-token';
export const APPROVED_CAPTURE_TOKEN = '1002:test-capture-bot-token';
export const CARLAB_CAPTURE_TOKEN = '1003:test-carlab-capture-token';

const CRM_ENV = {
  TELEGRAM_BOT_TOKEN: CRM_TOKEN,
  TELEGRAM_BOT_USERNAME: 'crm_test_bot',
  TELEGRAM_GROUP_ID: '-1009876543210',
  TELEGRAM_OWNER_ID: '111',
  TELEGRAM_ADMIN_ID: '222',
  TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
  CRON_SECRET: 'test-cron-secret',
  SHOP_API_URL: 'https://shop.test',
  SHOP_VISITOR_SEARCHES_SECRET: 'test-visitor-searches-secret',
};

export function createCrmRoutes() {
  Object.assign(process.env, CRM_ENV);
  const store = createLeadStore();
  const leadStore = {
    ...store,
    setStatus: vi.fn(store.setStatus),
    recordDigestMessage: vi.fn(store.recordDigestMessage),
    findUnsettledOrderLeads: vi.fn(store.findUnsettledOrderLeads),
  };
  const ledger = createLedgerStore();
  const ledgerStore = {
    ...ledger,
    answerOperationPrompt: vi.fn(ledger.answerOperationPrompt),
  };
  const bot = createBrandBot({ store: leadStore, serviceLabel });
  const captureClients = new Map([
    [
      'Approved.rs',
      createTelegramClient(APPROVED_CAPTURE_TOKEN, 'approved_capture_bot'),
    ],
    [
      'CarLab',
      createTelegramClient(CARLAB_CAPTURE_TOKEN, 'carlab_capture_bot'),
    ],
  ]);
  const webhook = createCrmWebhookRoute({
    leadStore,
    ledgerStore,
    bot,
    captureClientFor: (brand) => captureClients.get(brand),
    phoneRegion: 'RS',
  });
  const reminders = createRemindersRoute({ leadStore, bot });
  return { leadStore, ledgerStore, bot, webhook, reminders };
}
