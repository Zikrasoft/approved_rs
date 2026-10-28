import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import { adminError } from '../../../../../../lib/admin-errors';
import {
  readIdentifierImages,
  writeIdentifierImages,
} from '../../../../../../lib/images';
import { CATALOG_MODULE } from '../../../../../../modules/catalog';
import type CatalogModuleService from '../../../../../../modules/catalog/service';
import type { AdminOrderImagesType } from '../../../../validators';

export async function POST(
  req: AuthenticatedMedusaRequest<AdminOrderImagesType>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const { ids } = req.validatedBody;
  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const current = await readIdentifierImages(catalog, id);
  const ordered = ids.flatMap((imageId) =>
    current.filter((image) => image.id === imageId).slice(0, 1),
  );
  if (
    new Set(ids).size !== ids.length ||
    ordered.length !== current.length ||
    ids.length !== current.length
  ) {
    throw adminError(
      MedusaError.Types.INVALID_DATA,
      'INVALID_FIELD',
      'ids: List every image of the brand-number once',
      { field: 'ids' },
    );
  }

  res.json(
    await writeIdentifierImages(
      catalog,
      id,
      ordered,
      req.auth_context.actor_id,
    ),
  );
}
