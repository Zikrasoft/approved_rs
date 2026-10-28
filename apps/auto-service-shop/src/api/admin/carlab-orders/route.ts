import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';

import { isCashAtPickup, leadHandoff } from '../../../lib/order-view';

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const orders = await req.scope.resolve(Modules.ORDER).listOrders(
    {
      created_at: {
        $gte: new Date(Date.now() - RECENT_MS).toISOString(),
      },
    },
    {
      select: ['id', 'display_id', 'created_at', 'metadata'],
      order: { created_at: 'DESC' },
      take: null,
    },
  );
  res.json({
    orders: orders
      .filter(({ metadata }) => isCashAtPickup(metadata))
      .map(({ id, display_id, created_at, metadata }) => ({
        id,
        display_id,
        created_at,
        lead: leadHandoff(metadata),
      }))
      .filter(({ lead }) => !lead.handed_off_at),
  });
}
