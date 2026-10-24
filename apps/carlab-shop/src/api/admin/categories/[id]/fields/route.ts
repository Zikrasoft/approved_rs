import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';
import type { AdminCreateCategoryFieldType } from '../../../validators';
import { createdBy } from '../../../../../lib/editors';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateCategoryFieldType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const body = req.validatedBody;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await catalog.retrieveCategory(id);
  await catalog.guardCategoryDefinition(id, (fields) => [
    ...fields,
    { key: body.key, type: body.type, required: body.required, options: [] },
  ]);

  const field = await catalog.createCategoryFields({
    ...body,
    category_id: id,
    ...createdBy(req),
  });

  res.json({ field });
}
