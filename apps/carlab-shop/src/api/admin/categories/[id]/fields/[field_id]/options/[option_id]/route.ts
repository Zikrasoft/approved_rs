import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { retrieveCategoryFieldOption } from '../../../../../../../../lib/categories';
import { CATALOG_MODULE } from '../../../../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../../../../modules/catalog/service';
import type { AdminUpdateCategoryFieldOptionType } from '../../../../../../validators';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateCategoryFieldOptionType>,
  res: MedusaResponse,
): Promise<void> {
  const { id, field_id, option_id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await retrieveCategoryFieldOption(catalog, id, field_id, option_id);

  const option = await catalog.updateCategoryFieldOptions({
    id: option_id,
    ...req.validatedBody,
    updated_by: req.auth_context.actor_id,
  });

  res.json({ option });
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, field_id, option_id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const { field, option } = await retrieveCategoryFieldOption(
    catalog,
    id,
    field_id,
    option_id,
  );
  await catalog.guardCategoryDefinition(id, (fields) =>
    fields.map((definition) =>
      definition.key === field.key
        ? {
            ...definition,
            options: definition.options.filter(({ key }) => key !== option.key),
          }
        : definition,
    ),
  );

  await catalog.deleteCategoryFieldOptions(option_id);

  res.json({ id: option_id, object: 'category_field_option', deleted: true });
}
