import { createBrandBot } from '@podbor/lead-crm';
import { serviceLabel } from '@podbor/brands';
import { BRAND, leadStore } from './crm';

export const {
  notifier,
  ensureLeadCard,
  ensureLeadTopic,
  touchLeadTopic,
  closeLeadTopic,
  afterStatusChange,
  notifyLead,
  client,
  formatter,
  groupId,
  ownerIds,
  adminIds,
} = createBrandBot({
  store: leadStore,
  brand: BRAND,
  serviceLabel,
});
