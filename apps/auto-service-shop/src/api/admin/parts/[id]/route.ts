import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { deletePartWorkflow } from '../../../../workflows/delete-catalog-rows';
import type { AdminUpdatePartType } from '../../validators';
import { updatedBy } from '../../../../lib/editors';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdatePartType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  await catalog.editPart(id, req.validatedBody, updatedBy(req).updated_by);

  const part = await catalog.retrievePart(id);
  res.json({
    part: {
      id,
      name: part.name,
      description: part.description,
      replaced_by_id: part.replaced_by_id,
      category_id: part.category_id,
      attributes: part.attributes,
      installation_price: part.installation_price,
      no_installation: part.no_installation,
      updated_by: part.updated_by,
    },
  });
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const part = await catalog.retrievePart(id, { relations: ['identifiers'] });
  await deletePartWorkflow(req.scope).run({
    input: {
      id,
      identifierIds: part.identifiers.map((identifier) => identifier.id),
    },
  });

  res.json({ id, object: 'part', deleted: true });
}
