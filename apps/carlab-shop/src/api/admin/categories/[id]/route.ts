import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import type { AdminUpdateCategoryType } from '../../validators';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateCategoryType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await catalog.retrieveCategory(id);
  const category = await catalog.updateCategories({
    id,
    ...req.validatedBody,
    updated_by: req.auth_context.actor_id,
  });

  res.json({ category });
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await catalog.retrieveCategory(id);

  const [, used] = await catalog.listAndCountParts(
    { category_id: id },
    { take: 1 },
  );
  if (used) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Category ${id} holds ${used} parts`,
    );
  }

  await catalog.deleteCategories(id);

  res.json({ id, object: 'category', deleted: true });
}
