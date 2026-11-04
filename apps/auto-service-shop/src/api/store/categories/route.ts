import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { categoriesResponseSchema } from '@podbor/catalog-contract';

import { CATEGORY_RELATIONS, withRankedFields } from '../../../lib/categories';
import { pricesShown } from '../../../lib/shop-gate';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const categories = await catalog.listCategories(
    {},
    { relations: CATEGORY_RELATIONS, order: { slug: 'ASC' } },
  );

  const shown = pricesShown(req);
  res.json(
    categoriesResponseSchema.parse({
      categories: categories
        .map(withRankedFields)
        .map((category) =>
          shown
            ? category
            : { ...category, service_price: null, installation_price: null },
        ),
    }),
  );
}
