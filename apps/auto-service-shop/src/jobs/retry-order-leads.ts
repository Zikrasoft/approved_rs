import type { MedusaContainer } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import { leadHandoff } from '../lib/line-metadata';
import { handOrderToLeadRoute } from '../lib/order-lead';

const RETRY_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const SUBSCRIBER_GRACE_MS = 2 * 60 * 1000;

export async function retryOrderLeadsAt(container: MedusaContainer, now: Date) {
  const orders = await container.resolve(Modules.ORDER).listOrders(
    {
      created_at: {
        $gte: new Date(now.getTime() - RETRY_WINDOW_MS).toISOString(),
        $lte: new Date(now.getTime() - SUBSCRIBER_GRACE_MS).toISOString(),
      },
    },
    { select: ['id', 'metadata'] },
  );
  for (const { id, metadata } of orders) {
    const lead = leadHandoff(metadata);
    if (!lead.handed_off_at && !lead.gave_up) {
      await handOrderToLeadRoute(container, id);
    }
  }
}

export default async function retryOrderLeads(container: MedusaContainer) {
  await retryOrderLeadsAt(container, new Date());
}

export const config = {
  name: 'retry-order-leads',
  schedule: '*/10 * * * *',
};
