import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { normalizePartNumber } from '@podbor/catalog-contract';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import type { AdminCreatePartType, AdminSearchPartsType } from '../validators';
import { createdBy, withEditors } from '../../../lib/editors';
import {
  PART_RELATIONS,
  adminPart,
  adminPartSchema,
} from '../../../lib/admin-part';
import { literalLike } from '../../../lib/like';

const PART_SEARCH_LIMIT = 50;

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminSearchPartsType>,
  res: MedusaResponse,
): Promise<void> {
  const { q } = req.validatedQuery as AdminSearchPartsType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const contains = `%${literalLike(q)}%`;
  const brands = await catalog.listBrands(
    { name: { $ilike: contains } },
    { select: ['id'], take: null },
  );
  const normalized = normalizePartNumber(q);
  const matches = await catalog.listPartIdentifiers(
    {
      $or: [
        ...(normalized
          ? [{ normalized_value: { $like: `%${literalLike(normalized)}%` } }]
          : []),
        { brand_id: brands.map((brand) => brand.id) },
      ],
    },
    { select: ['part_id'], take: PART_SEARCH_LIMIT },
  );
  const named = await catalog.listParts(
    { name: { $ilike: contains } },
    { select: ['id'], take: PART_SEARCH_LIMIT },
  );

  const partIds = [
    ...new Set([
      ...matches.map((identifier) => identifier.part_id),
      ...named.map((part) => part.id),
    ]),
  ].slice(0, PART_SEARCH_LIMIT);
  const parts = partIds.length
    ? await catalog.listParts(
        { id: partIds },
        { relations: PART_RELATIONS, take: null },
      )
    : [];

  res.json({
    parts: await withEditors(req.scope, z.array(adminPartSchema).parse(parts)),
  });
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreatePartType>,
  res: MedusaResponse,
): Promise<void> {
  const { name, identifiers, category_id, attributes } = req.validatedBody;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const partId = await catalog.createPartWithIdentifiers({
    name,
    identifiers,
    category_id,
    attributes,
    ...createdBy(req),
  });

  res.json({ part: await adminPart(catalog, partId) });
}
