export const prerender = false;

import { captureStore, createCaptureWebhookRoute } from '@podbor/lead-capture';
import { BRAND, leadStore } from '@/lib/crm';
import { CAPTURE_WEBHOOK_SECRET, captureClient } from '@/lib/captureBot';
import { ensureLeadCard } from '@/lib/crmBot';
import { PRIMARY_LOCALE, isLocale } from '@/i18n/config';
import { getCaptureBotCopy } from '@/i18n/content/captureBot';
import { isServiceSlug } from '@/utils/labels';

export const POST = createCaptureWebhookRoute({
  secret: CAPTURE_WEBHOOK_SECRET,
  store: captureStore(leadStore),
  ensureLeadCard,
  bot: captureClient,
  brand: BRAND,
  isService: isServiceSlug,
  isLocale,
  primaryLocale: PRIMARY_LOCALE,
  copy: getCaptureBotCopy,
});
