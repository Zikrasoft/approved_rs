import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import {
  refuseTakenOptionLabel,
  retrieveCategoryField,
} from '../../../../../../../lib/categories';
import { CATALOG_MODULE } from '../../../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../../../modules/catalog/service';
import type { AdminCreateCategoryFieldOptionType } from '../../../../../validators';
import { createdBy } from '../../../../../../../lib/editors';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateCategoryFieldOptionType>,
  res: MedusaResponse,
): Promise<void> {
  const { id, field_id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await retrieveCategoryField(catalog, id, field_id);
  await refuseTakenOptionLabel(catalog, field_id, req.validatedBody.label);

  const option = await catalog.createCategoryFieldOptions({
    ...req.validatedBody,
    field_id,
    ...createdBy(req),
  });

  res.json({ option });
}
