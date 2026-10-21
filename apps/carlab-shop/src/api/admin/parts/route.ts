import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../../modules/catalog';
import { PART_IDENTIFIER_TYPES } from '../../../modules/catalog/models/part-identifier';
import type CatalogModuleService from '../../../modules/catalog/service';
import type { AdminCreatePartType, AdminSearchPartsType } from '../validators';

const identifierSchema = z.object({
  id: z.string(),
  type: z.enum(PART_IDENTIFIER_TYPES),
  brand: z.string(),
  value: z.string(),
});

const partSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  identifiers: z.array(identifierSchema),
});

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminSearchPartsType>,
  res: MedusaResponse,
): Promise<void> {
  const { q } = req.validatedQuery as AdminSearchPartsType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const matches = await catalog.listPartIdentifiers({
    $or: [{ value: { $ilike: `%${q}%` } }, { brand: { $ilike: `%${q}%` } }],
  });

  const partIds = [...new Set(matches.map((identifier) => identifier.part_id))];
  const parts = partIds.length
    ? await catalog.listParts({ id: partIds }, { relations: ['identifiers'] })
    : [];

  res.json({ parts: z.array(partSchema).parse(parts) });
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreatePartType>,
  res: MedusaResponse,
): Promise<void> {
  const { name, identifier } = req.validatedBody;
  const actor = {
    created_by: req.auth_context.actor_id,
    updated_by: req.auth_context.actor_id,
  };

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const part = await catalog.createParts({ name, ...actor });
  const createdIdentifier = await catalog.createPartIdentifiers({
    part_id: part.id,
    ...identifier,
    ...actor,
  });

  res.json({
    part: partSchema.parse({ ...part, identifiers: [createdIdentifier] }),
  });
}
