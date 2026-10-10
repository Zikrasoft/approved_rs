export const prerender = false;

import { captureStore, createCaptureWebhookRoute } from '@podbor/lead-capture';
import { BRAND, leadStore } from '@/lib/crm';
import { CAPTURE_WEBHOOK_SECRET, captureBot } from '@/lib/captureBot';
import { ensureLeadCard, notifier } from '@/lib/crmBot';
import { PRIMARY_LOCALE, isLocale } from '@/i18n/config';
import { content } from '@/i18n/content';
import { SITE_URL } from '@/utils/constants';
import { SERVICE_SLUGS } from '@/utils/labels';
import { PathBuilder } from '@/utils/paths';

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
  menu: ['services', 'request'],
  questionnaire: ['looking_for', 'budget', 'phone'],
  services: SERVICE_SLUGS,
  serviceCard: (slug, locale) => {
    const { hub } = content(locale).services[slug];
    return {
      title: `${hub.title} ${hub.titleHighlight}`,
      lines: [hub.description],
      url: new URL(PathBuilder.sectionRoot(locale, slug), SITE_URL).href,
    };
  },
});
