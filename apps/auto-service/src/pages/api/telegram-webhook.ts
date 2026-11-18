export const prerender = false;

import { createCrmWebhookRoute } from '@podbor/lead-crm';
import { leadStore, ledgerStore } from '@/lib/crm';
import { crmBot } from '@/lib/crmBot';
import { captureClientFor } from '@/lib/captureBot';

export const { POST } = createCrmWebhookRoute({
  leadStore,
  ledgerStore,
  bot: crmBot,
  captureClientFor,
  phoneRegion: 'RS',
});
