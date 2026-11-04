import { createBrandBot } from '@podbor/lead-crm';
import { serviceLabel as brandServiceLabel } from '@podbor/brands';
import { isServiceSlug } from '@/utils/services';
import { leadStore } from './crm';
import { content } from '@/i18n/content';

const ruServices = content('ru').services;

export const {
  notifier,
  ensureLeadCard,
  ensureLeadTopic,
  touchLeadTopic,
  cancelOrderLead,
  groupId,
} = createBrandBot({
  store: leadStore,
  serviceLabel: (slug) =>
    isServiceSlug(slug) ? ruServices[slug].name : brandServiceLabel(slug),
});
