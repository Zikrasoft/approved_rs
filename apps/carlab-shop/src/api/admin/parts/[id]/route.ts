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
  const {
    name,
    description,
    replaced_by_id,
    category_id,
    attributes,
    installation_price,
    no_installation,
  } = req.validatedBody;
  const { updated_by } = updatedBy(req);
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const current = await catalog.retrievePart(id);
  if (
    name !== undefined ||
    description !== undefined ||
    installation_price !== undefined ||
    no_installation !== undefined
  ) {
    await catalog.updateParts({
      id,
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(installation_price !== undefined && { installation_price }),
      ...(no_installation !== undefined && { no_installation }),
      updated_by,
    });
  }
  if (category_id !== undefined || attributes !== undefined) {
    const nextCategoryId =
      category_id === undefined ? current.category_id : category_id;
    const categoryChanged = nextCategoryId !== current.category_id;
    await catalog.classifyPart(id, {
      category_id: nextCategoryId,
      attributes: attributes ?? (categoryChanged ? {} : current.attributes),
      updated_by,
    });
  }
  if (replaced_by_id !== undefined) {
    await catalog.replacePart(id, replaced_by_id, updated_by);
  }

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
