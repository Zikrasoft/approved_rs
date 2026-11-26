import type { MedusaContainer } from '@medusajs/framework/types';
import {
  partPageSchema,
  partPageSlug,
  translated,
  type CatalogLocale,
  type Fitment,
  type PartDemand,
  type PartOffer,
  type PartPage,
  type SluggedPartPage,
  type SupplierData,
} from '@podbor/catalog-contract';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { PUBLISH_MODULE } from '../modules/publish';
import type {
  default as PublishModuleService,
  PublishedNumber,
} from '../modules/publish/service';
import { SUPPLIER_MODULE } from '../modules/supplier';
import { releasedSupplierData } from '../modules/supplier/released';
import type SupplierModuleService from '../modules/supplier/service';
import { groupBy } from './group-by';
import { imagesSchema, publicFileUrl, publicImage } from './images';
import { installationPrice } from './installation';
import { memoPartDemand } from './part-demand';

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
  images: imagesSchema.parse(row.images).items.map(publicImage),
});

const publicSupplierData = (data: SupplierData): SupplierData => ({
  ...data,
  images: data.images.map(publicFileUrl),
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

type PageOptions = { shown: boolean; demand: Map<string, PartDemand> };

export async function partPagesAfter(
  scope: MedusaContainer,
  { after, limit, ...options }: PageOptions & { after?: string; limit: number },
) {
  const published = await scope
    .resolve<PublishModuleService>(PUBLISH_MODULE)
    .publishedPage({ after, limit });
  return { pages: await partPagesOf(scope, published, options), published };
}

export async function partPagesOf(
  scope: MedusaContainer,
  published: PublishedNumber[],
  { shown, demand }: PageOptions,
) {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const pageIds = published.map(({ id }) => id);
  const listedById = new Map(published.map(({ id, listed }) => [id, listed]));
  const rows = await catalog.partPageRows(pageIds);
  const identifiers = rows.filter(({ id }) => listedById.has(id));
  const pictured = new Map(
    rows.map((row) => [row.id, picturedBrandNumber(row)]),
  );
  const siblingsOf = groupBy(rows, ({ part_id }) => part_id);

  const replacementIds = [
    ...new Set(identifiers.map(({ part }) => part.replaced_by_id)),
  ].filter((id) => id !== null);
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const identifierIds = identifiers.map(({ id }) => id);
  const [replacements, offers, supplierData] = await Promise.all([
    replacementIds.length
      ? catalog.listParts(
          { id: replacementIds },
          { relations: ['identifiers', 'identifiers.brand'], take: null },
        )
      : [],
    shown
      ? suppliers.storeOffersFor(identifierIds)
      : new Map<string, PartOffer[]>(),
    releasedSupplierData(suppliers, identifierIds),
  ]);
  const replacementOf = new Map(
    replacements.map((part) => [part.id, part] as const),
  );
  const replacedBy = (id: string | null) => {
    const part = id && replacementOf.get(id);
    return part ? replacement(part) : null;
  };

  return identifiers.map((identifier) => ({
    ...pictured.get(identifier.id)!,
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
    equivalents: (siblingsOf.get(identifier.part_id) ?? [])
      .filter(({ id }) => id !== identifier.id)
      .map(({ id }) => pictured.get(id)!),
    offers: offers.get(identifier.id) ?? [],
    supplier_data: publicSupplierData(supplierData(identifier.id)),
    demand: demand.get(identifier.id) ?? null,
  }));
}

export const localizedFit = (fit: Fitment, locale: CatalogLocale) => ({
  ...fit,
  note: fit.note && translated({ ...fit, note: fit.note }, 'note', locale),
  translations: null,
});

const localized = (page: PartPage, locale: CatalogLocale): PartPage => {
  const { part } = page;
  return {
    ...page,
    part: {
      ...part,
      name: translated(part, 'name', locale),
      description:
        part.description &&
        translated(
          { ...part, description: part.description },
          'description',
          locale,
        ),
      translations: null,
      replaced_by: part.replaced_by && {
        ...part.replaced_by,
        name: translated(part.replaced_by, 'name', locale),
        translations: null,
      },
    },
  };
};

export async function sluggedPagesOf(
  scope: MedusaContainer,
  published: PublishedNumber[],
  {
    locale,
    shown,
    demand,
  }: {
    locale: CatalogLocale;
    shown: boolean;
    demand?: Map<string, PartDemand>;
  },
): Promise<SluggedPartPage[]> {
  const pages = await partPagesOf(scope, published, {
    shown,
    demand: demand ?? (await memoPartDemand(scope)),
  });
  const seen = new Set<string>();
  return pages
    .map((raw) => {
      const page = partPageSchema.parse(raw);
      return {
        ...localized(page, locale),
        slug: partPageSlug(page.brand.slug, page.normalized_value),
      };
    })
    .filter(({ slug }) => !seen.has(slug) && seen.add(slug));
}

export const publishedOfParts = (
  scope: MedusaContainer,
  partIds: string[],
  only?: string[],
): Promise<(PublishedNumber & { part_id: string })[]> =>
  scope
    .resolve<PublishModuleService>(PUBLISH_MODULE)
    .publishedNumbersOfParts(partIds, only);
