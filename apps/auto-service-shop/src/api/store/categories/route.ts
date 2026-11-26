import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { categoriesResponseSchema } from '@podbor/catalog-contract';

import { memoized } from '../../../lib/catalogue-memo';
import { CATEGORY_RELATIONS, shownCategory } from '../../../lib/categories';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';

const CATEGORIES_TTL_MS = 60_000;

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const body = await memoized(
    'store-categories',
    async () =>
      categoriesResponseSchema.parse({
        categories: (
          await catalog.listCategories(
            {},
            { relations: CATEGORY_RELATIONS, order: { slug: 'ASC' } },
          )
        ).map(shownCategory),
      }),
    CATEGORIES_TTL_MS,
  );

  res.json(body);
}
