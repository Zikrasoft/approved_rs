import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import {
  partPagesResponseSchema,
  STAGED_DATA_KINDS,
  type SupplierData,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { partImagesSchema } from '../../../lib/images';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import { storeOffers } from '../../../modules/supplier/pricing';
import type SupplierModuleService from '../../../modules/supplier/service';
import type { StoreListPartPagesType } from '../validators';

const stagedPayloadSchema = z.object({ items: z.array(z.unknown()) });

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
  const offers = await suppliers.listSupplierOffers(
    { part_identifier_id: identifierIds },
    { relations: ['supplier'], take: null },
  );
  const staged = await suppliers.listStagedRecords(
    { part_identifier_id: identifierIds },
    { relations: ['supplier'], take: null },
  );
  const supplierData = (identifierId: string) =>
    Object.fromEntries(
      STAGED_DATA_KINDS.map((kind) => [
        kind,
        staged
          .filter(
            (record) =>
              record.part_identifier_id === identifierId &&
              record.kind === kind &&
              record.supplier.released_kinds.includes(kind),
          )
          .flatMap((record) => stagedPayloadSchema.parse(record.payload).items),
      ]),
    ) as SupplierData;

  const pages = identifiers.map((identifier) => ({
    ...brandNumber(identifier),
    part: {
      id: identifier.part.id,
      name: identifier.part.name,
      translations: identifier.part.translations,
      replaced_by: replacedBy(identifier.part.replaced_by_id),
      category_id: identifier.part.category_id,
      attributes: identifier.part.attributes,
      images: partImagesSchema.parse(identifier.part.images).items,
    },
    equivalents: siblings
      .filter(
        ({ id, part_id }) =>
          part_id === identifier.part_id && id !== identifier.id,
      )
      .map(brandNumber),
    offers: storeOffers(
      offers.filter((offer) => offer.part_identifier_id === identifier.id),
    ),
    supplier_data: supplierData(identifier.id),
  }));

  res.json(partPagesResponseSchema.parse({ pages, count, offset, limit }));
}
