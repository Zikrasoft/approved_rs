export const prerender = false;

import {
  captureStore,
  createCaptureWebhookRoute,
  specsCard,
} from '@podbor/lead-capture';
import { BRAND, leadStore } from '@/lib/crm';
import { CAPTURE_WEBHOOK_SECRET, captureBot } from '@/lib/captureBot';
import { ensureLeadCard, notifier } from '@/lib/crmBot';
import { PRIMARY_LOCALE, isLocale } from '@/i18n/config';
import { content } from '@/i18n/content';
import { STUDIO_ADDRESS, PHONE_NUMBER, SITE_URL } from '@/utils/constants';
import { PathBuilder } from '@/utils/paths';
import { SERVICE_SLUGS } from '@/utils/services';

export const POST = createCaptureWebhookRoute({
  secret: CAPTURE_WEBHOOK_SECRET,
  store: captureStore(leadStore),
  ensureLeadCard,
  sendFieldChangeToAdmin: notifier.sendFieldChangeToAdmin,
  bot: captureBot,
  brand: BRAND,
  isLocale,
  primaryLocale: PRIMARY_LOCALE,
  copy: (locale) => content(locale).captureBot,
  menu: ['services', 'contacts', 'manager'],
  services: SERVICE_SLUGS,
  contacts: {
    phone: PHONE_NUMBER,
    site: SITE_URL,
    venue: { title: BRAND, ...STUDIO_ADDRESS },
  },
  serviceCard: (slug, locale) => {
    const services = content(locale).services;
    const url = new URL(PathBuilder.service(locale, slug), SITE_URL).href;
    return specsCard(services, services[slug], url);
  },
});
