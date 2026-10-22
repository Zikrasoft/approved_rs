import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import {
  adminImage,
  deleteImageFiles,
  readImageUpload,
  storedImageSchema,
  storeImage,
  type StoredImage,
} from '../../../../../lib/images';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../modules/catalog/service';

async function replaceImage(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: (id: string) => Promise<StoredImage | null>,
) {
  const { id } = req.params;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const category = await catalog.retrieveCategory(id);
  const previous = storedImageSchema.nullable().parse(category.image);
  const image = await next(id);
  await catalog.updateCategories({
    id,
    image,
    updated_by: req.auth_context.actor_id,
  });
  await deleteImageFiles(req.scope, previous ? [previous] : []);

  res.json({ image: image && adminImage(image) });
}

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) =>
  replaceImage(req, res, async (id) =>
    storeImage(
      req.scope,
      await readImageUpload(req),
      `categories/${id}`,
      req.auth_context.actor_id,
    ),
  );

export const DELETE = (req: AuthenticatedMedusaRequest, res: MedusaResponse) =>
  replaceImage(req, res, async () => null);
