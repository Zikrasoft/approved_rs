import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import {
  CATALOGUE_LOCALE_HEADER,
  catalogueLocaleSchema,
} from '@podbor/catalog-contract';

import { makePageAt } from '../../../../../lib/catalogue-makes';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const page = await makePageAt(req.scope, req.params.slug, {
    locale: catalogueLocaleSchema.parse(req.headers[CATALOGUE_LOCALE_HEADER]),
  });
  if (!page) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No such Make page');
  }
  res.json(page);
}
