import { createBrandBot } from '@podbor/lead-crm';
import { serviceLabel } from '@podbor/brands';
import { leadStore } from './crm';

export const {
  notifier,
  ensureLeadCard,
  ensureLeadTopic,
  touchLeadTopic,
  closeLeadTopic,
  afterStatusChange,
  settlePendingOrders,
  dropFromDigest,
  client,
  formatter,
  groupId,
  ownerIds,
  adminIds,
} = createBrandBot({
  store: leadStore,
  serviceLabel,
});
