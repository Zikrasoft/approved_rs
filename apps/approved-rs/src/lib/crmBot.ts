import { createBrandBot } from '@podbor/lead-crm';
import { serviceLabel } from '@podbor/brands';
import { leadStore } from './crm';

export const {
  notifier,
  ensureLeadCard,
  ensureLeadTopic,
  touchLeadTopic,
  groupId,
} = createBrandBot({
  store: leadStore,
  serviceLabel,
});
