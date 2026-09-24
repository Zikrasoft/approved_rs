import { BRANDS, COMMISSION_PERCENT, PARTNER_SERVICE } from '@podbor/brands';
import type { LeadHandOff, NotifyLead } from '@podbor/lead-crm';
import { notifyLead as notifyOwnLead } from './crmBot';

const HAND_OFF: Record<string, LeadHandOff> = Object.fromEntries(
  Object.entries(PARTNER_SERVICE).map(([key, service]) => [
    service,
    {
      brand: BRANDS[key as keyof typeof PARTNER_SERVICE].name,
      commissionPercent:
        COMMISSION_PERCENT[key as keyof typeof PARTNER_SERVICE],
    },
  ]),
);

export const notifyLead: NotifyLead = (data, logPrefix) =>
  notifyOwnLead(data, logPrefix, HAND_OFF[data.service]);
