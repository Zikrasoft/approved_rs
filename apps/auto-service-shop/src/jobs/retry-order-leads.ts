import type { MedusaContainer } from '@medusajs/framework/types';

import { orderLeadSync } from '../lib/order-lead-sync';

export const retryOrderLeadsAt = (container: MedusaContainer, now: Date) =>
  orderLeadSync(container).retryDue(now);

export default async function retryOrderLeads(container: MedusaContainer) {
  await retryOrderLeadsAt(container, new Date());
}

export const config = {
  name: 'retry-order-leads',
  schedule: '*/10 * * * *',
};
