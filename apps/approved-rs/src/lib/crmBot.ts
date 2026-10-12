import { createBrandBot } from '@podbor/lead-crm';
import { serviceLabel } from '@podbor/brands';
import { BRAND, leadStore } from './crm';
import { REPLY_RELAY_BRANDS } from './captureBot';

export const {
  notifier,
  ensureLeadCard,
  ensureLeadTopic,
  afterStatusChange,
  notifyLead,
  client,
  formatter,
  ownerIds,
  adminIds,
  groupId,
} = createBrandBot({
  store: leadStore,
  brand: BRAND,
  serviceLabel,
  replyRelayBrands: REPLY_RELAY_BRANDS,
});
