import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { CARLAB } from '@podbor/brands';

import { parseEnv } from '../../../../lib/env';
import { readLeadOrder } from '../../../../lib/order-lead';
import { carlabOrderView } from '../../../../lib/order-view';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = await req.scope
    .resolve(Modules.ORDER)
    .retrieveOrder(req.params.id);
  const { LEAD_ROUTE_URL } = parseEnv(process.env);
  res.json({
    order: carlabOrderView(await readLeadOrder(req.scope, id)),
    storefront_url: LEAD_ROUTE_URL
      ? new URL(LEAD_ROUTE_URL).origin
      : CARLAB.url,
  });
}
