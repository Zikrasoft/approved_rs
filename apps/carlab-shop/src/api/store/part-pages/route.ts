import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { partPagesResponseSchema } from '@podbor/catalog-contract';

import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import type SupplierModuleService from '../../../modules/supplier/service';
import type { StoreListPartPagesType } from '../validators';

type BrandNumberRow = {
  id: string;
  type: string;
  value: string;
  normalized_value: string;
  brand: { name: string; slug: string };
};

const brandNumber = ({
  id,
  type,
  value,
  normalized_value,
  brand,
}: BrandNumberRow) => ({
  id,
  type,
  value,
  normalized_value,
  brand: { name: brand.name, slug: brand.slug },
});

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

  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const offers = await suppliers.listSupplierOffers(
    { part_identifier_id: identifiers.map(({ id }) => id) },
    { select: ['part_identifier_id'] },
  );
  const offered = new Set(offers.map((offer) => offer.part_identifier_id));

  const pages = identifiers.map((identifier) => ({
    ...brandNumber(identifier),
    part: { id: identifier.part.id, name: identifier.part.name },
    equivalents: siblings
      .filter(
        ({ id, part_id }) =>
          part_id === identifier.part_id && id !== identifier.id,
      )
      .map(brandNumber),
    has_offers: offered.has(identifier.id),
  }));

  res.json(partPagesResponseSchema.parse({ pages, count, offset, limit }));
}
