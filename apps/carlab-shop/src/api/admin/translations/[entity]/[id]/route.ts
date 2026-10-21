import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import {
  editTranslation,
  readTranslations,
} from '../../../../../lib/publish/translate';
import { CATALOG_MODULE } from '../../../../../modules/catalog';
import type { AdminEditTranslationType } from '../../../validators';

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const { entity, id } = req.params;
  res.json({
    translations: await readTranslations(
      req.scope.resolve(CATALOG_MODULE),
      entity,
      id,
    ),
  });
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminEditTranslationType>,
  res: MedusaResponse,
): Promise<void> {
  const { entity, id } = req.params;
  const { locale, fields } = req.validatedBody;
  res.json({
    translations: await editTranslation(
      req.scope.resolve(CATALOG_MODULE),
      entity,
      id,
      locale,
      fields,
      req.auth_context.actor_id,
    ),
  });
}
