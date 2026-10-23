import type { MedusaContainer } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import {
  handOffAttempts,
  handOrderToLeadRoute,
  LEAD_HANDED_OFF_AT,
  LEAD_HANDOFF_MAX_ATTEMPTS,
} from '../lib/order-lead';

const RETRY_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const SUBSCRIBER_GRACE_MS = 2 * 60 * 1000;

export default async function retryOrderLeads(
  container: MedusaContainer,
  now: Date = new Date(),
) {
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
    if (
      !metadata?.[LEAD_HANDED_OFF_AT] &&
      handOffAttempts(metadata) < LEAD_HANDOFF_MAX_ATTEMPTS
    ) {
      await handOrderToLeadRoute(container, id);
    }
  }
}

export const config = {
  name: 'retry-order-leads',
  schedule: '*/10 * * * *',
};
