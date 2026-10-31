import { createBrandBot } from '@podbor/lead-crm';
import { serviceLabel as brandServiceLabel } from '@podbor/brands';
import { content } from '@/i18n/content';
import { isServiceSlug } from '@/utils/services';
import { leadStore } from './crm';

const ruServices = content('ru').services;

export const {
  notifier,
  ensureLeadCard,
  ensureLeadTopic,
  touchLeadTopic,
  groupId,
} = createBrandBot({
  store: leadStore,
  serviceLabel: (slug) =>
    isServiceSlug(slug) ? ruServices[slug].name : brandServiceLabel(slug),
});
