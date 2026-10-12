import { createBrandBot } from '@podbor/lead-crm';
import { serviceLabel as brandServiceLabel } from '@podbor/brands';
import { content } from '@/i18n/content';
import { isServiceSlug } from '@/utils/services';
import { BRAND, leadStore } from './crm';

const ruServices = content('ru').services;

export const { notifier, ensureLeadCard, ensureLeadTopic, notifyLead } =
  createBrandBot({
    store: leadStore,
    brand: BRAND,
    serviceLabel: (slug) =>
      isServiceSlug(slug) ? ruServices[slug].name : brandServiceLabel(slug),
  });
