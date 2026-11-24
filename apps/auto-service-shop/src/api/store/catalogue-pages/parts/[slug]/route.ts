import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import {
  CATALOGUE_LOCALE_HEADER,
  catalogueLocaleSchema,
  partPageResponseSchema,
} from '@podbor/catalog-contract';

import { partPageAt } from '../../../../../lib/part-page';
import { pricesShown } from '../../../../../lib/shop-gate';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const page = await partPageAt(req.scope, req.params.slug, {
    locale: catalogueLocaleSchema.parse(req.headers[CATALOGUE_LOCALE_HEADER]),
    shown: pricesShown(req),
  });
  if (!page) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No such Part page');
  }
  res.json(partPageResponseSchema.parse(page));
}
