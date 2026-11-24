import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import {
  CATALOGUE_LOCALE_HEADER,
  catalogueLocaleSchema,
  categoryPageResponseSchema,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { categoryPageAt } from '../../../../../lib/category-page';
import { pricesShown } from '../../../../../lib/shop-gate';

const pageSchema = z.coerce.number().int().positive().catch(0);

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const page = pageSchema.parse(req.query.page ?? 1);
  const answer =
    page > 0 &&
    (await categoryPageAt(req.scope, req.params.slug, {
      locale: catalogueLocaleSchema.parse(req.headers[CATALOGUE_LOCALE_HEADER]),
      shown: pricesShown(req),
      page,
    }));
  if (!answer) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No such Category page');
  }
  res.json(categoryPageResponseSchema.parse(answer));
}
