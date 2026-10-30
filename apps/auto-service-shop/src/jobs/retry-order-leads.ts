import type { MedusaContainer } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import {
  handCancelToLeadRoute,
  handOrderToLeadRoute,
  leadHandoff,
} from '../lib/order-lead';

const RETRY_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
const SUBSCRIBER_GRACE_MS = 2 * 60 * 1000;

export async function retryOrderLeadsAt(container: MedusaContainer, now: Date) {
  const orderModule = container.resolve(Modules.ORDER);
  const orders = await orderModule.listOrders(
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
  const touched = await orderModule.listOrders(
    {
      updated_at: {
        $gte: new Date(now.getTime() - RETRY_WINDOW_MS).toISOString(),
      },
    },
    { select: ['id', 'status'] },
  );
  for (const { id, status } of touched) {
    if (status === 'canceled') await handCancelToLeadRoute(container, id);
  }
}

export default async function retryOrderLeads(container: MedusaContainer) {
  await retryOrderLeadsAt(container, new Date());
}

export const config = {
  name: 'retry-order-leads',
  schedule: '*/10 * * * *',
};
