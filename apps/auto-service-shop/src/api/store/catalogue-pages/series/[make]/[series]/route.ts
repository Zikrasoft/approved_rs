import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import {
  CATALOGUE_LOCALE_HEADER,
  catalogueLocaleSchema,
  seriesPageResponseSchema,
} from '@podbor/catalog-contract';

import { seriesPageAt } from '../../../../../../lib/series-page';
import { pricesShown } from '../../../../../../lib/shop-gate';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const page = await seriesPageAt(
    req.scope,
    req.params.make,
    req.params.series,
    {
      locale: catalogueLocaleSchema.parse(req.headers[CATALOGUE_LOCALE_HEADER]),
      shown: pricesShown(req),
    },
  );
  if (!page) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No such Series page');
  }
  res.json(seriesPageResponseSchema.parse(page));
}
