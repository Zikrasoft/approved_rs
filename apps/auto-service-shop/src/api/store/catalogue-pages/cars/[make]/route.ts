import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import {
  CATALOGUE_LOCALE_HEADER,
  catalogueLocaleSchema,
} from '@podbor/catalog-contract';

import { carMakePageAt } from '../../../../../lib/catalogue-cars';
import { pricesShown } from '../../../../../lib/shop-gate';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const page = await carMakePageAt(req.scope, req.params.make, {
    locale: catalogueLocaleSchema.parse(req.headers[CATALOGUE_LOCALE_HEADER]),
    shown: pricesShown(req),
  });
  if (!page) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No such Car Make page');
  }
  res.json(page);
}
