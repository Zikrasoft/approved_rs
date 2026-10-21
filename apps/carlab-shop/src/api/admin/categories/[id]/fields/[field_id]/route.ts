import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { retrieveCategoryField } from '../../../../../../lib/categories';
import { CATALOG_MODULE } from '../../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../../modules/catalog/service';
import type { AdminUpdateCategoryFieldType } from '../../../../validators';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateCategoryFieldType>,
  res: MedusaResponse,
): Promise<void> {
  const { id, field_id } = req.params;
  const body = req.validatedBody;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const { key } = await retrieveCategoryField(catalog, id, field_id);
  await catalog.guardCategoryDefinition(id, (fields) =>
    fields.map((field) =>
      field.key === key
        ? {
            ...field,
            type: body.type ?? field.type,
            required: body.required ?? field.required,
          }
        : field,
    ),
  );

  const field = await catalog.updateCategoryFields({
    id: field_id,
    ...body,
    updated_by: req.auth_context.actor_id,
  });

  res.json({ field });
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, field_id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const { key } = await retrieveCategoryField(catalog, id, field_id);
  await catalog.guardCategoryDefinition(id, (fields) =>
    fields.filter((field) => field.key !== key),
  );

  await catalog.deleteCategoryFields(field_id);

  res.json({ id: field_id, object: 'category_field', deleted: true });
}
