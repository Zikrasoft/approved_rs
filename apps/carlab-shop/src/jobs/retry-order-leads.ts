import type { MedusaContainer } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import {
  handOffAttempts,
  handOrderToLeadRoute,
  LEAD_HANDOFF_ERROR,
  LEAD_HANDOFF_MAX_ATTEMPTS,
} from '../lib/order-lead';

const RETRY_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

export default async function retryOrderLeads(container: MedusaContainer) {
  const orders = await container
    .resolve(Modules.ORDER)
    .listOrders(
      {
        created_at: {
          $gte: new Date(Date.now() - RETRY_WINDOW_MS).toISOString(),
        },
      },
      { select: ['id', 'metadata'] },
    );
  for (const { id, metadata } of orders) {
    if (
      metadata?.[LEAD_HANDOFF_ERROR] &&
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
