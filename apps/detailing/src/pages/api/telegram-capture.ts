export const prerender = false;

import { createCaptureWebhookRoute, specsCard } from '@podbor/lead-capture';
import { BRAND, leadStore } from '@/lib/crm';
import {
  CAPTURE_WEBHOOK_SECRET,
  captureBot,
  reportMetaLead,
} from '@/lib/captureBot';
import {
  ensureLeadCard,
  ensureLeadTopic,
  groupId,
  touchLeadTopic,
} from '@/lib/crmBot';
import { LOCALE_NAME, PRIMARY_LOCALE, isLocale } from '@/i18n/config';
import { content } from '@/i18n/content';
import {
  PHONE_NUMBER,
  SITE_URL,
  STUDIO_ADDRESS,
  TG_MANAGER,
} from '@/utils/constants';
import { PathBuilder } from '@/utils/paths';
import { SERVICE_SLUGS } from '@/utils/services';

export const POST = createCaptureWebhookRoute({
  secret: CAPTURE_WEBHOOK_SECRET,
  store: leadStore,
  ensureLeadTopic,
  touchLeadTopic,
  ensureLeadCard,
  bot: captureBot,
  groupId,
  brand: BRAND,
  isLocale,
  primaryLocale: PRIMARY_LOCALE,
  copy: (locale) => content(locale).captureBot,
  menu: ['request', 'services', 'contacts', 'language', 'manager'],
  humanTelegram: TG_MANAGER,
  questionnaire: ['car'],
  phoneRegion: 'RS',
  reportMetaLead,
  languages: LOCALE_NAME,
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
