import { createBrandBot } from '@podbor/lead-crm';
import { serviceLabel as brandServiceLabel } from '@podbor/brands';
import { isServiceSlug } from '@/utils/services';
import { BRAND, leadStore } from './crm';
import { content } from '@/i18n/content';

const ruServices = content('ru').services;

export const { notifier, ensureLeadCard, notifyLead } = createBrandBot({
  store: leadStore,
  brand: BRAND,
  serviceLabel: (slug) =>
    isServiceSlug(slug) ? ruServices[slug].name : brandServiceLabel(slug),
});
