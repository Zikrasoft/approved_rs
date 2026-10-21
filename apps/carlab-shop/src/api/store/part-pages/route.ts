import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { partPagesResponseSchema } from '@podbor/catalog-contract';

import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import type { StoreListPartPagesType } from '../validators';

type BrandNumberRow = {
  id: string;
  type: string;
  value: string;
  normalized_value: string;
  superseded: boolean;
  brand: { name: string; slug: string };
};

type ReplacementRow = {
  id: string;
  name: string;
  identifiers: BrandNumberRow[];
};

const brandNumber = ({
  id,
  type,
  value,
  normalized_value,
  superseded,
  brand,
}: BrandNumberRow) => ({
  id,
  type,
  value,
  normalized_value,
  superseded,
  brand: { name: brand.name, slug: brand.slug },
});

const replacement = ({ id, name, identifiers }: ReplacementRow) => {
  const [current] = [...identifiers].sort(
    (a, b) =>
      Number(a.superseded) - Number(b.superseded) || a.id.localeCompare(b.id),
  );
  return current ? { id, name, brand_number: brandNumber(current) } : null;
};

export async function GET(
  req: MedusaRequest<unknown, StoreListPartPagesType>,
  res: MedusaResponse,
): Promise<void> {
  const { offset, limit } = req.validatedQuery as StoreListPartPagesType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);

  const [identifiers, count] = await catalog.listAndCountPartIdentifiers(
    {},
    {
      relations: ['brand', 'part'],
      order: { id: 'ASC' },
      skip: offset,
      take: limit,
    },
  );

  const siblings = await catalog.listPartIdentifiers(
    { part_id: [...new Set(identifiers.map(({ part_id }) => part_id))] },
    { relations: ['brand'], order: { id: 'ASC' } },
  );

  const replacementIds = [
    ...new Set(identifiers.map(({ part }) => part.replaced_by_id)),
  ].filter((id) => id !== null);
  const replacements = replacementIds.length
    ? await catalog.listParts(
        { id: replacementIds },
        { relations: ['identifiers', 'identifiers.brand'] },
      )
    : [];
  const replacedBy = (id: string | null) => {
    const part = replacements.find((candidate) => candidate.id === id);
    return part ? replacement(part) : null;
  };

  const pages = identifiers.map((identifier) => ({
    ...brandNumber(identifier),
    part: {
      id: identifier.part.id,
      name: identifier.part.name,
      replaced_by: replacedBy(identifier.part.replaced_by_id),
    },
    equivalents: siblings
      .filter(
        ({ id, part_id }) =>
          part_id === identifier.part_id && id !== identifier.id,
      )
      .map(brandNumber),
  }));

  res.json(partPagesResponseSchema.parse({ pages, count, offset, limit }));
}
