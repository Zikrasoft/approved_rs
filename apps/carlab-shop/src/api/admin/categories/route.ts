import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { CATEGORY_RELATIONS, withRankedFields } from '../../../lib/categories';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import type { AdminCreateCategoryType } from '../validators';

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const categories = await catalog.listCategories(
    {},
    { relations: CATEGORY_RELATIONS, order: { name: 'ASC' } },
  );

  res.json({ categories: categories.map(withRankedFields) });
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateCategoryType>,
  res: MedusaResponse,
): Promise<void> {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const category = await catalog.createCategories({
    ...req.validatedBody,
    created_by: req.auth_context.actor_id,
    updated_by: req.auth_context.actor_id,
  });

  res.json({ category });
}
