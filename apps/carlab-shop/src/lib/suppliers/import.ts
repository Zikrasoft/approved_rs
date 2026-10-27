import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import {
  type AttributeValues,
  normalizePartNumber,
  STAGED_DATA_KINDS,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import type { PartClassification } from '../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../modules/supplier';
import { inShopCurrency } from '../../modules/supplier/pricing';
import type SupplierModuleService from '../../modules/supplier/service';
import {
  type ArticleFacts,
  type CategoryChoice,
  type CategoryFieldChoice,
  shopAi,
  type ShopAi,
} from '../ai';
import {
  cataloguePageSchema,
  type SupplierAdapter,
  supplierAdapters,
  supplierQuoteSchema,
} from './adapter';
import { emitIndexChanges } from '../index-changes';
import { quotedFields } from './live-quote';
import { spellingKey } from './spelling';
import { fitVehicles, type VehicleMatcher, vehicleMatcher } from './vehicles';

type Article = z.output<typeof cataloguePageSchema>['articles'][number];
type Quote = z.output<typeof supplierQuoteSchema>;

export type ImportSummary = {
  supplier: string;
  imported: number;
  created: number;
  skipped: number;
  skipped_by_reason: { brand: number; currency: number; unreadable: number };
  needs_category: string[];
};

type Context = {
  adapter: SupplierAdapter;
  supplierId: string;
  catalog: CatalogModuleService;
  suppliers: SupplierModuleService;
  ai: ShopAi;
  categories: CategoryChoice[];
  logger: Logger;
  matched: Set<string>;
  vehicles: VehicleMatcher;
};

const factsOf = (article: Article): ArticleFacts => ({
  name: article.name,
  brand: article.brand,
  number: article.number,
  description: article.description ?? null,
  specs: article.specs ?? {},
});

async function orElse<T>(
  { adapter, logger }: Context,
  article: Article,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    logger.warn(
      `Supplier import ${adapter.name}, ${article.number}: AI failed, ${error instanceof Error ? error.message : String(error)}`,
    );
    return fallback;
  }
}

async function fieldsOf(
  catalog: CatalogModuleService,
  categoryId: string,
): Promise<CategoryFieldChoice[]> {
  const fields = await catalog.listCategoryFields(
    { category_id: categoryId },
    { relations: ['options'], take: null },
  );
  return fields.map(({ key, label, type, unit, required, options }) => ({
    key,
    label,
    type,
    unit,
    required,
    options: options.map((option) => ({
      key: option.key,
      label: option.label,
    })),
  }));
}

const describe = (context: Context, article: Article) =>
  article.description || article.specs
    ? orElse(
        context,
        article,
        () => context.ai.writeDescription(factsOf(article)),
        null,
      )
    : Promise.resolve(null);

const nameOf = (context: Context, article: Article) =>
  orElse(context, article, () => context.ai.writeName(factsOf(article)), null);

async function classify(
  context: Context,
  article: Article,
  mappedCategoryId: string | undefined,
): Promise<{ category_id: string | null; attributes: AttributeValues }> {
  const { ai, catalog, categories } = context;
  const categoryId =
    mappedCategoryId ??
    (await orElse(
      context,
      article,
      () => ai.pickCategory(factsOf(article), categories),
      null,
    ));
  const { specs } = article;
  const fields = categoryId && specs ? await fieldsOf(catalog, categoryId) : [];
  const attributes =
    specs && fields.length
      ? await orElse(context, article, () => ai.mapSpecs(specs, fields), {})
      : {};
  return { category_id: categoryId, attributes };
}

const refusedAttributes = (error: unknown) =>
  MedusaError.isMedusaError(error) && error.code === 'INVALID_ATTRIBUTES';

async function createPart(
  context: Context,
  article: Article,
  brandId: string,
  mappedCategoryId: string | undefined,
): Promise<{ identifierId: string; partId: string; categorized: boolean }> {
  const { adapter, catalog } = context;
  const name = await nameOf(context, article);
  const part = {
    name: name ?? article.name,
    source_name: name && article.name,
    description: await describe(context, article),
    identifiers: [
      {
        type: 'manufacturer-number' as const,
        brand_id: brandId,
        value: article.number,
      },
    ],
    source: adapter.name,
  };
  const classification = await classify(context, article, mappedCategoryId);
  let categoryId = classification.category_id;
  const create = (attempt: Partial<PartClassification>) =>
    catalog.createPartWithIdentifiers({ ...part, ...attempt });
  const unlessRefused = (retry: () => Promise<string>) => (error: unknown) => {
    if (!refusedAttributes(error)) throw error;
    return retry();
  };
  const partId = await create(classification)
    .catch(unlessRefused(() => create({ category_id: categoryId })))
    .catch(
      unlessRefused(() => {
        categoryId = null;
        return create({});
      }),
    );
  const [identifier] = await catalog.listPartIdentifiers({ part_id: partId });
  return {
    identifierId: identifier.id,
    partId,
    categorized: Boolean(categoryId),
  };
}

async function matchArticle(
  context: Context,
  article: Article,
  brandId: string,
  categoryId: string | undefined,
): Promise<{
  identifierId: string;
  partId: string;
  created: boolean;
  changedPartId?: string;
  categorized?: boolean;
}> {
  const { adapter, catalog } = context;
  const [hit] = await catalog.listPartIdentifiers(
    {
      brand_id: brandId,
      normalized_value: normalizePartNumber(article.number),
    },
    { relations: ['part'], take: 1 },
  );
  if (!hit) {
    const { identifierId, partId, categorized } = await createPart(
      context,
      article,
      brandId,
      categoryId,
    );
    return {
      identifierId,
      partId,
      created: true,
      changedPartId: partId,
      categorized,
    };
  }
  const { part } = hit;
  const unchanged = { identifierId: hit.id, partId: part.id, created: false };
  if (part.source !== adapter.name || part.updated_by) {
    return unchanged;
  }
  const name =
    context.matched.has(hit.id) || part.source_name === article.name
      ? null
      : await nameOf(context, article);
  const description = part.description
    ? null
    : await describe(context, article);
  if (!name && !description) {
    return unchanged;
  }
  await catalog.updateParts({
    id: part.id,
    ...(name && { name, source_name: article.name }),
    ...(description && { description }),
  });
  return { ...unchanged, changedPartId: part.id };
}

async function storeOffer(
  { supplierId, suppliers }: Context,
  identifierId: string,
  quote: Quote,
): Promise<void> {
  const offer = {
    supplier_id: supplierId,
    supplier_article_id: quote.article_id,
    part_identifier_id: identifierId,
    ...quotedFields(quote),
  };
  const [existing] = await suppliers.listSupplierOffers({
    supplier_id: supplierId,
    supplier_article_id: quote.article_id,
  });
  await (existing
    ? suppliers.updateSupplierOffers({ id: existing.id, ...offer })
    : suppliers.createSupplierOffers(offer));
}

async function stage(
  { supplierId, suppliers }: Context,
  identifierId: string,
  article: Article,
): Promise<void> {
  for (const kind of STAGED_DATA_KINDS) {
    const items = article[kind];
    if (!items) {
      continue;
    }
    const [existing] = await suppliers.listStagedRecords({
      supplier_id: supplierId,
      part_identifier_id: identifierId,
      kind,
    });
    if (!items.length) {
      if (existing) {
        await suppliers.deleteStagedRecords(existing.id);
      }
      continue;
    }
    await (existing
      ? suppliers.updateStagedRecords({ id: existing.id, payload: { items } })
      : suppliers.createStagedRecords({
          supplier_id: supplierId,
          part_identifier_id: identifierId,
          kind,
          payload: { items },
        }));
  }
}

// TODO: one query per article; batch the identifier and offer lookups per page once real catalogue sizes make the import on Publish slow.
export async function importSupplier(
  scope: MedusaContainer,
  adapter: SupplierAdapter,
): Promise<ImportSummary> {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const [supplier] = await suppliers.listSuppliers({ name: adapter.name });
  if (!supplier) {
    throw new Error(`No Supplier is named ${adapter.name}`);
  }
  const context: Context = {
    adapter,
    supplierId: supplier.id,
    catalog,
    suppliers,
    ai: shopAi(scope),
    categories: (
      await catalog.listCategories({}, { select: ['id', 'name'], take: null })
    ).map(({ id, name }) => ({ id, name })),
    logger: scope.resolve(ContainerRegistrationKeys.LOGGER),
    matched: new Set(),
    vehicles: vehicleMatcher(catalog, adapter.name),
  };
  const categoryOf = new Map(
    (
      await suppliers.listSupplierCategories(
        { supplier_id: supplier.id },
        { take: null },
      )
    ).map(({ code_key, category_id }) => [code_key, category_id]),
  );
  const brandOf = new Map(
    (
      await catalog.listBrandSpellings(
        { supplier_id: supplier.id },
        { take: null },
      )
    ).map(({ value_key, brand_id }) => [value_key, brand_id]),
  );
  const summary: ImportSummary = {
    supplier: adapter.name,
    imported: 0,
    created: 0,
    skipped: 0,
    skipped_by_reason: { brand: 0, currency: 0, unreadable: 0 },
    needs_category: [],
  };
  const brandOfArticle = (article: Article) =>
    brandOf.get(spellingKey(article.brand));
  const categoryOfArticle = (article: Article) =>
    categoryOf.get(spellingKey(article.category));
  const listed = new Set<string>();
  const changedPartIds = new Set<string>();

  for (let cursor: string | null = null; ;) {
    const page = cataloguePageSchema.parse(await adapter.listCatalogue(cursor));
    for (const { url, reason } of page.unreadable) {
      context.logger.warn(
        `${adapter.name}: skipped unreadable ${url}: ${reason}`,
      );
    }
    summary.skipped += page.unreadable.length;
    summary.skipped_by_reason.unreadable += page.unreadable.length;
    const wanted = page.articles.filter(brandOfArticle);
    const unbranded = page.articles.length - wanted.length;
    summary.skipped += unbranded;
    summary.skipped_by_reason.brand += unbranded;
    const quoted = wanted.length
      ? z
          .array(supplierQuoteSchema)
          .parse(
            await adapter.quote(wanted.map(({ article_id }) => article_id)),
          )
      : [];
    const quotes = new Map(
      quoted.filter(inShopCurrency).map((quote) => [quote.article_id, quote]),
    );
    summary.skipped_by_reason.currency += quoted.length - quotes.size;
    for (const article of wanted) {
      const { identifierId, partId, created, changedPartId, categorized } =
        await matchArticle(
          context,
          article,
          brandOfArticle(article)!,
          categoryOfArticle(article),
        );
      context.matched.add(identifierId);
      if (changedPartId) {
        changedPartIds.add(changedPartId);
      }
      if (categorized === false) {
        summary.needs_category.push(article.number);
      }
      const quote = quotes.get(article.article_id);
      if (quote) {
        await storeOffer(context, identifierId, quote);
        listed.add(article.article_id);
      }
      await stage(context, identifierId, article);
      if (article.vehicles) {
        await fitVehicles(context.vehicles, partId, article.vehicles);
      }
      summary.imported += Number(!created);
      summary.created += Number(created);
    }
    if (!page.next) {
      break;
    }
    cursor = page.next;
  }

  const gone = (
    await suppliers.listSupplierOffers(
      { supplier_id: supplier.id },
      { select: ['id', 'supplier_article_id'], take: null },
    )
  ).filter(({ supplier_article_id }) => !listed.has(supplier_article_id));
  if (gone.length) {
    await suppliers.deleteSupplierOffers(gone.map(({ id }) => id));
  }
  await emitIndexChanges(scope, { partIds: changedPartIds });
  return summary;
}

export async function importSupplierCatalogues(
  scope: MedusaContainer,
): Promise<ImportSummary[]> {
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const skipped = new Set(
    (
      await suppliers.listSuppliers({
        $or: [{ import_enabled: false }, { import_on_publish: false }],
      })
    ).map(({ name }) => name),
  );
  const summaries: ImportSummary[] = [];
  for (const adapter of supplierAdapters(scope)) {
    if (skipped.has(adapter.name)) {
      continue;
    }
    summaries.push(await importSupplier(scope, adapter));
  }
  return summaries;
}
