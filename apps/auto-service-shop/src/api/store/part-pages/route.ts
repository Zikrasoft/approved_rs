import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { partPagesResponseSchema } from '@podbor/catalog-contract';

import { memoPartDemand } from '../../../lib/part-demand';
import { partPagesAfter } from '../../../lib/part-pages';
import { pricesShown } from '../../../lib/shop-gate';
import { nextCursor } from '../../../lib/store-response';
import type { StoreListPartPagesType } from '../validators';

export async function GET(
  req: MedusaRequest<unknown, StoreListPartPagesType>,
  res: MedusaResponse,
): Promise<void> {
  const { after, limit } = req.validatedQuery as StoreListPartPagesType;

  const { pages, published } = await partPagesAfter(req.scope, {
    after,
    limit,
    shown: pricesShown(req),
    demand: await memoPartDemand(req.scope),
  });

  res.json(
    partPagesResponseSchema.parse({
      pages,
      limit,
      next: nextCursor(published, limit),
    }),
  );
}
