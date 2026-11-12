import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  partPagesResponseSchema,
  type PartOffer,
} from '@podbor/catalog-contract';

import { imagesSchema } from '../../../lib/images';
import { installationPrice } from '../../../lib/installation';
import { loadPartDemand } from '../../../lib/part-demand';
import { pricesShown } from '../../../lib/shop-gate';
import { nextCursor } from '../../../lib/store-response';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../../modules/publish';
import type PublishModuleService from '../../../modules/publish/service';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
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
  const { after, limit } = req.validatedQuery as StoreListPartPagesType;

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const published = await req.scope
    .resolve<PublishModuleService>(PUBLISH_MODULE)
    .publishedPage({ after, limit });
  const pageIds = published.map(({ id }) => id);
  const listedById = new Map(published.map(({ id, listed }) => [id, listed]));
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
    ? await suppliers.storeOffersFor(identifierIds)
    : new Map<string, PartOffer[]>();
  const supplierData = await releasedSupplierData(suppliers, identifierIds);
  const demand = await loadPartDemand(req.scope);

  const pages = identifiers.map((identifier) => ({
    ...picturedBrandNumber(identifier),
    listed: listedById.get(identifier.id),
    part: {
      id: identifier.part.id,
      name: identifier.part.name,
      description: identifier.part.description,
      translations: identifier.part.translations,
      replaced_by: replacedBy(identifier.part.replaced_by_id),
      category_id: identifier.part.category_id,
      attributes: identifier.part.attributes,
      installation_price: installationPrice(identifier.part),
    },
    equivalents: siblings
      .filter(
        ({ id, part_id }) =>
          part_id === identifier.part_id && id !== identifier.id,
      )
      .map(picturedBrandNumber),
    offers: offers.get(identifier.id) ?? [],
    supplier_data: supplierData(identifier.id),
    demand: demand.get(identifier.id) ?? null,
  }));

  res.json(
    partPagesResponseSchema.parse({
      pages,
      limit,
      next: nextCursor(published, limit),
    }),
  );
}
