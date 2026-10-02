export const prerender = false;

import { createCaptureWebhookRoute } from '@podbor/lead-capture';
import { BRAND, leadStore } from '@/lib/crm';
import { CAPTURE_WEBHOOK_SECRET } from '@/lib/captureBot';
import { ensureLeadCard } from '@/lib/crmBot';
import { PRIMARY_LOCALE, isLocale } from '@/i18n/config';
import { SERVICE_SLUGS } from '@/utils/labels';

const services: readonly string[] = SERVICE_SLUGS;

export const POST = createCaptureWebhookRoute({
  secret: CAPTURE_WEBHOOK_SECRET,
  store: leadStore,
  ensureLeadCard,
  brand: BRAND,
  isService: (value) => services.includes(value),
  isLocale,
  primaryLocale: PRIMARY_LOCALE,
});
