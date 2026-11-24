import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import {
  CATALOGUE_LOCALE_HEADER,
  catalogueLocaleSchema,
  seriesCategoryPageResponseSchema,
} from '@podbor/catalog-contract';

import { seriesCategoryPageAt } from '../../../../../../../lib/series-page';
import { pricesShown } from '../../../../../../../lib/shop-gate';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const page = await seriesCategoryPageAt(
    req.scope,
    req.params.make,
    req.params.series,
    req.params.category,
    {
      locale: catalogueLocaleSchema.parse(req.headers[CATALOGUE_LOCALE_HEADER]),
      shown: pricesShown(req),
    },
  );
  if (!page) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      'No such Series Category page',
    );
  }
  res.json(seriesCategoryPageResponseSchema.parse(page));
}
