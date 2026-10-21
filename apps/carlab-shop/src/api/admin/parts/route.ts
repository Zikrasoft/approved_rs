import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { normalizePartNumber } from '@podbor/catalog-contract';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../../modules/catalog';
import { PART_IDENTIFIER_TYPES } from '../../../modules/catalog/models/part-identifier';
import type CatalogModuleService from '../../../modules/catalog/service';
import type { AdminCreatePartType, AdminSearchPartsType } from '../validators';

const identifierSchema = z.object({
  id: z.string(),
  type: z.enum(PART_IDENTIFIER_TYPES),
  value: z.string(),
  normalized_value: z.string(),
  brand: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
});

const partSchema = z.object({
  id: z.string(),
  name: z.string(),
  category_id: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  source: z.string(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  identifiers: z.array(identifierSchema),
});

const PART_RELATIONS = ['identifiers', 'identifiers.brand'];

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminSearchPartsType>,
  res: MedusaResponse,
): Promise<void> {
  const { q } = req.validatedQuery as AdminSearchPartsType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const brands = await catalog.listBrands({ name: { $ilike: `%${q}%` } });
  const normalized = normalizePartNumber(q);
  const matches = await catalog.listPartIdentifiers({
    $or: [
      ...(normalized
        ? [{ normalized_value: { $like: `%${normalized}%` } }]
        : []),
      { brand_id: brands.map((brand) => brand.id) },
    ],
  });

  const partIds = [...new Set(matches.map((identifier) => identifier.part_id))];
  const parts = partIds.length
    ? await catalog.listParts({ id: partIds }, { relations: PART_RELATIONS })
    : [];

  res.json({ parts: z.array(partSchema).parse(parts) });
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreatePartType>,
  res: MedusaResponse,
): Promise<void> {
  const { name, identifiers, category_id, attributes } = req.validatedBody;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const brandIds = [...new Set(identifiers.map(({ brand_id }) => brand_id))];
  const brands = await catalog.listBrands({ id: brandIds });
  if (brands.length !== brandIds.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Unknown brand');
  }

  const partId = await catalog.createPartWithIdentifiers({
    name,
    identifiers,
    category_id,
    attributes,
    created_by: req.auth_context.actor_id,
    updated_by: req.auth_context.actor_id,
  });

  const part = await catalog.retrievePart(partId, {
    relations: PART_RELATIONS,
  });

  res.json({ part: partSchema.parse(part) });
}
