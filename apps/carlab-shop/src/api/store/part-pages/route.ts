import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { partPagesResponseSchema } from '@podbor/catalog-contract';

import { imagesSchema } from '../../../lib/images';
import { installationPrice } from '../../../lib/installation';
import { pricesShown } from '../../../lib/offer-cart';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../../modules/publish';
import type PublishModuleService from '../../../modules/publish/service';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import { storeOffers } from '../../../modules/supplier/pricing';
import { releasedSupplierData } from '../../../modules/supplier/released';
import type SupplierModuleService from '../../../modules/supplier/service';
import type { StoreListPartPagesType } from '../validators';

type BrandNumberRow = {
  id: string;
  type: string;
  value: string;
  normalized_value: string;
  superseded: boolean;
  brand: { name: string; slug: string };
  images: unknown;
};

type ReplacementRow = {
  id: string;
  name: string;
  translations: unknown;
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

const picturedBrandNumber = (row: BrandNumberRow) => ({
  ...brandNumber(row),
  images: imagesSchema.parse(row.images).items,
});

const replacement = ({
  id,
  name,
  translations,
  identifiers,
}: ReplacementRow) => {
  const [current] = [...identifiers].sort(
    (a, b) =>
      Number(a.superseded) - Number(b.superseded) || a.id.localeCompare(b.id),
  );
  return current
    ? { id, name, translations, brand_number: brandNumber(current) }
    : null;
};

export async function GET(
  req: MedusaRequest<unknown, StoreListPartPagesType>,
  res: MedusaResponse,
): Promise<void> {
  const { offset, limit } = req.validatedQuery as StoreListPartPagesType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const publish: PublishModuleService = req.scope.resolve(PUBLISH_MODULE);

  const published = new Set(
    (
      await publish.listPublishedNumbers({}, { select: ['id'], take: null })
    ).map(({ id }) => id),
  );
  const listed = (
    await catalog.listPartIdentifiers(
      {},
      { select: ['id'], order: { id: 'ASC' }, take: null },
    )
  ).flatMap(({ id }) => (published.has(id) ? [id] : []));
  const count = listed.length;
  const pageIds = listed.slice(offset, offset + limit);
  const identifiers = pageIds.length
    ? await catalog.listPartIdentifiers(
        { id: pageIds },
        {
          relations: ['brand', 'part', 'part.category'],
          order: { id: 'ASC' },
          take: null,
        },
      )
    : [];

  const siblings = await catalog.listPartIdentifiers(
    { part_id: [...new Set(identifiers.map(({ part_id }) => part_id))] },
    { relations: ['brand'], order: { id: 'ASC' }, take: null },
  );

  const replacementIds = [
    ...new Set(identifiers.map(({ part }) => part.replaced_by_id)),
  ].filter((id) => id !== null);
  const replacements = replacementIds.length
    ? await catalog.listParts(
        { id: replacementIds },
        { relations: ['identifiers', 'identifiers.brand'], take: null },
      )
    : [];
  const replacedBy = (id: string | null) => {
    const part = replacements.find((candidate) => candidate.id === id);
    return part ? replacement(part) : null;
  };
  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const identifierIds = identifiers.map(({ id }) => id);
  const shown = pricesShown(req);
  const offers = shown
    ? await suppliers.listSupplierOffers(
        { part_identifier_id: identifierIds },
        { relations: ['supplier'], take: null },
      )
    : [];
  const supplierData = await releasedSupplierData(suppliers, identifierIds);

  const pages = identifiers.map((identifier) => ({
    ...picturedBrandNumber(identifier),
    part: {
      id: identifier.part.id,
      name: identifier.part.name,
      description: identifier.part.description,
      translations: identifier.part.translations,
      replaced_by: replacedBy(identifier.part.replaced_by_id),
      category_id: identifier.part.category_id,
      attributes: identifier.part.attributes,
      installation_price: shown ? installationPrice(identifier.part) : null,
    },
    equivalents: siblings
      .filter(
        ({ id, part_id }) =>
          part_id === identifier.part_id && id !== identifier.id,
      )
      .map(picturedBrandNumber),
    offers: storeOffers(
      offers.filter((offer) => offer.part_identifier_id === identifier.id),
    ),
    supplier_data: supplierData(identifier.id),
  }));

  res.json(partPagesResponseSchema.parse({ pages, count, offset, limit }));
}
