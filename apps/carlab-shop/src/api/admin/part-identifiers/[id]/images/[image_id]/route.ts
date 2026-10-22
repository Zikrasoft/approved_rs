import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import {
  deleteImageFiles,
  readIdentifierImages,
  writeIdentifierImages,
} from '../../../../../../lib/images';
import { CATALOG_MODULE } from '../../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../../modules/catalog/service';

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { id, image_id } = req.params;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const current = await readIdentifierImages(catalog, id);
  const removed = current.filter((image) => image.id === image_id);
  if (!removed.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Image ${image_id} not found on brand-number ${id}`,
    );
  }

  const result = await writeIdentifierImages(
    catalog,
    id,
    current.filter((image) => image.id !== image_id),
    req.auth_context.actor_id,
  );
  await deleteImageFiles(req.scope, removed);
  res.json(result);
}
