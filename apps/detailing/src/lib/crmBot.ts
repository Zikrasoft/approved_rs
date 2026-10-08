import { createBrandBot } from '@podbor/lead-crm';
import { serviceLabel as brandServiceLabel } from '@podbor/brands';
import { getServicesContent } from '@/i18n/content/services';
import { isServiceSlug } from '@/utils/services';
import { BRAND, leadStore } from './crm';

const ruServices = getServicesContent('ru');

export const { notifier, ensureLeadCard, notifyLead } = createBrandBot({
  store: leadStore,
  brand: BRAND,
  serviceLabel: (slug) =>
    isServiceSlug(slug) ? ruServices[slug].name : brandServiceLabel(slug),
});
