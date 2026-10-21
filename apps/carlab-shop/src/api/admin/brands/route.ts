import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { withEditors } from '../../../lib/editors';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import type { AdminCreateBrandType } from '../validators';

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const brands = await catalog.listBrands(
    {},
    { relations: ['spellings'], order: { name: 'ASC' }, take: null },
  );

  res.json({ brands: await withEditors(req.scope, brands) });
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateBrandType>,
  res: MedusaResponse,
): Promise<void> {
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const brand = await catalog.createBrands({
    ...req.validatedBody,
    created_by: req.auth_context.actor_id,
    updated_by: req.auth_context.actor_id,
  });

  res.json({ brand });
}
