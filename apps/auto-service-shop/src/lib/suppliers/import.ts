import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import {
  normalizePartNumber,
  STAGED_DATA_KINDS,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import type {
  FoundPart,
  PartClassification,
} from '../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../modules/supplier';
import { inShopCurrency } from '../../modules/supplier/pricing';
import type SupplierModuleService from '../../modules/supplier/service';
import {
  type ArticleAnswer,
  type ArticleFacts,
  type CategoryChoice,
  type CategoryFieldChoice,
  shopAi,
  type ShopAi,
} from '../ai';
import { cachedArticleAnswer } from '../ai/cache';
import {
  cataloguePageSchema,
  type SupplierAdapter,
  supplierAdapters,
  supplierQuoteSchema,
} from './adapter';
import { errorMessage } from '../errors';
import { emitIndexChanges } from '../index-changes';
import { shopStorage, type ShopStorage } from '../storage';
import { mirroredImage } from './mirrored-images';
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
  skipped_by_reason: {
    brand: number;
    currency: number;
    unreadable: number;
    no_engine_code: number;
    not_in_scope: number;
  };
  needs_category: string[];
  failed: { number: string; reason: string }[];
};

type ImportState = {
  summary: ImportSummary;
  listed: Set<string>;
  listedNumbers: Set<string>;
  changedPartIds: Set<string>;
};

type Context = {
  scope: MedusaContainer;
  adapter: SupplierAdapter;
  supplierId: string;
  catalog: CatalogModuleService;
  suppliers: SupplierModuleService;
  ai: ShopAi;
  categories: CategoryChoice[];
  logger: Logger;
  matched: Set<string>;
  vehicles: VehicleMatcher;
  storage: ShopStorage | null;
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
      `Supplier import ${adapter.name}, ${article.number}: AI failed, ${errorMessage(error)}`,
    );
    return fallback;
  }
}

async function categoryChoices(
  catalog: CatalogModuleService,
): Promise<CategoryChoice[]> {
  const [categories, fields] = await Promise.all([
    catalog.listCategories({}, { select: ['id', 'name', 'text'], take: null }),
    catalog.listCategoryFields({}, { relations: ['options'], take: null }),
  ]);
  return categories.map(({ id, name, text }) => ({
    id,
    name,
    text,
    fields: fields
      .filter(({ category_id }) => category_id === id)
      .map(
        ({
          key,
          label,
          type,
          unit,
          required,
          options,
        }): CategoryFieldChoice => ({
          key,
          label,
          type,
          unit,
          required,
          options: options.map((option) => ({
            key: option.key,
            label: option.label,
          })),
        }),
      ),
  }));
}

const answerOf = (
  context: Context,
  article: Article,
  categoryId: string | null,
) =>
  orElse(
    context,
    article,
    () =>
      cachedArticleAnswer(
        context.ai,
        context.storage?.pages ?? null,
        { ...factsOf(article), category_id: categoryId },
        context.categories,
      ),
    null,
  );

const lazily = <T>(run: () => Promise<T>) => {
  let running: Promise<T> | undefined;
  return () => (running ??= run());
};

function classificationOf(
  { categories }: Context,
  article: Article,
  mappedCategoryId: string | undefined,
  answer: ArticleAnswer | null,
): PartClassification {
  const picked = categories.find(({ id }) => id === answer?.category_id);
  const categoryId = mappedCategoryId ?? picked?.id ?? null;
  const mapped =
    answer && categoryId && article.specs && answer.category_id === categoryId;
  return {
    category_id: categoryId,
    attributes: mapped ? answer.attributes : {},
  };
}

const descriptionOf = (article: Article, answer: ArticleAnswer | null) =>
  article.description || article.specs ? (answer?.description ?? null) : null;

const refusedAttributes = (error: unknown) =>
  MedusaError.isMedusaError(error) && error.code === 'INVALID_ATTRIBUTES';

const unlessRefused =
  <T>(retry: () => Promise<T>) =>
  (error: unknown) => {
    if (!refusedAttributes(error)) throw error;
    return retry();
  };

async function filed<T>(
  classification: PartClassification,
  write: (attempt: PartClassification) => Promise<T>,
  unfiled: () => Promise<T>,
): Promise<{ written: T; categorized: boolean }> {
  let categorized = Boolean(classification.category_id);
  const written = await write(classification)
    .catch(
      unlessRefused(() =>
        write({ category_id: classification.category_id, attributes: {} }),
      ),
    )
    .catch(
      unlessRefused(() => {
        categorized = false;
        return unfiled();
      }),
    );
  return { written, categorized };
}

async function createPart(
  context: Context,
  article: Article,
  brandId: string,
  mappedCategoryId: string | undefined,
): Promise<FoundPart & { categorized: boolean }> {
  const { adapter, catalog } = context;
  const answer = await answerOf(context, article, mappedCategoryId ?? null);
  const classification = classificationOf(
    context,
    article,
    mappedCategoryId,
    answer,
  );
  const part = {
    name: answer?.name ?? article.name,
    source_name: answer && article.name,
    description: descriptionOf(article, answer),
    identifier: {
      type: 'manufacturer-number' as const,
      brand_id: brandId,
      value: article.number,
    },
    source: adapter.name,
    source_url: article.source_url ?? null,
  };
  const create = (attempt: Partial<PartClassification>) =>
    catalog.findOrCreatePart({ ...part, ...attempt });
  const { written, categorized } = await filed(classification, create, () =>
    create({}),
  );
  return { ...written, categorized };
}

async function fileUnfiled(
  context: Context,
  partId: string,
  classification: PartClassification,
): Promise<string | null> {
  if (!classification.category_id) return null;
  const { categorized } = await filed(
    classification,
    (attempt) => context.catalog.classifyPart(partId, attempt),
    async () => undefined,
  );
  return categorized ? classification.category_id : null;
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
    const found = await createPart(context, article, brandId, categoryId);
    return {
      identifierId: found.part_identifier_id,
      partId: found.part_id,
      created: found.created,
      ...(found.created && {
        changedPartId: found.part_id,
        categorized: found.categorized,
      }),
    };
  }
  const { part } = hit;
  const unchanged = { identifierId: hit.id, partId: part.id, created: false };
  if (part.source !== adapter.name) {
    return unchanged;
  }
  if (article.source_url && part.source_url !== article.source_url) {
    await catalog.updateParts({ id: part.id, source_url: article.source_url });
  }
  const edited = new Set(part.edited_fields);
  const fileable = !part.category_id && !edited.has('category_id');
  const answer = lazily(() =>
    answerOf(
      context,
      article,
      part.category_id ?? (fileable ? (categoryId ?? null) : null),
    ),
  );
  const filedCategoryId = fileable
    ? await fileUnfiled(
        context,
        part.id,
        classificationOf(context, article, categoryId, await answer()),
      )
    : undefined;
  const categorized =
    filedCategoryId === undefined ? undefined : Boolean(filedCategoryId);
  const name =
    edited.has('name') ||
    context.matched.has(hit.id) ||
    part.source_name === article.name
      ? null
      : ((await answer())?.name ?? null);
  const description =
    edited.has('description') || part.description
      ? null
      : descriptionOf(article, await answer());
  if (!name && !description) {
    return {
      ...unchanged,
      categorized,
      ...(filedCategoryId && { changedPartId: part.id }),
    };
  }
  await catalog.updateParts({
    id: part.id,
    ...(name && { name, source_name: article.name }),
    ...(description && { description }),
  });
  return { ...unchanged, categorized, changedPartId: part.id };
}

async function storeOffer(
  { supplierId, suppliers }: Context,
  identifierId: string,
  quote: Quote,
): Promise<void> {
  await suppliers.upsertSupplierOffer({
    supplier_id: supplierId,
    supplier_article_id: quote.article_id,
    part_identifier_id: identifierId,
    ...quotedFields(quote),
  });
}

async function stagedImages(
  { scope, storage, logger }: Context,
  images: string[],
): Promise<{ items: string[]; sources?: Record<string, string> }> {
  if (!storage) return { items: images };
  const sources: Record<string, string> = {};
  for (const source of images) {
    const mirrored = await mirroredImage(scope, storage, source, logger);
    if (mirrored) sources[mirrored] ??= source;
  }
  return { items: Object.keys(sources), sources };
}

async function stage(
  context: Context,
  identifierId: string,
  article: Article,
): Promise<void> {
  const { supplierId, suppliers } = context;
  for (const kind of STAGED_DATA_KINDS) {
    const listed = article[kind];
    if (!listed) {
      continue;
    }
    const payload =
      kind === 'images'
        ? await stagedImages(context, article.images!)
        : { items: listed };
    const key = {
      supplier_id: supplierId,
      part_identifier_id: identifierId,
      kind,
    };
    await (payload.items.length
      ? suppliers.upsertStagedRecord({ ...key, payload })
      : suppliers.deleteStagedRecords(key));
  }
}

async function importArticle(
  context: Context,
  { summary, listed, changedPartIds }: ImportState,
  article: Article,
  brandId: string,
  categoryId: string | undefined,
  quote: Quote | undefined,
): Promise<void> {
  const { identifierId, partId, created, changedPartId, categorized } =
    await matchArticle(context, article, brandId, categoryId);
  context.matched.add(identifierId);
  if (changedPartId) {
    changedPartIds.add(changedPartId);
  }
  if (quote) {
    await storeOffer(context, identifierId, quote);
    listed.add(article.article_id);
  }
  await stage(context, identifierId, article);
  if (article.vehicles) {
    await fitVehicles(context.vehicles, partId, article.vehicles);
    summary.skipped_by_reason.no_engine_code += article.vehicles.filter(
      ({ engine_codes }) => !engine_codes.length,
    ).length;
  }
  if (categorized === false) {
    summary.needs_category.push(article.number);
  }
  summary.imported += Number(!created);
  summary.created += Number(created);
}

async function flagUnlistedParts(
  catalog: CatalogModuleService,
  source: string,
  listedNumbers: Set<string>,
  unreadableUrls: Set<string>,
): Promise<void> {
  const mayFlag = (sourceUrl: string | null) =>
    sourceUrl ? !unreadableUrls.has(sourceUrl) : unreadableUrls.size === 0;
  const parts = await catalog.listParts(
    { source },
    { relations: ['identifiers'], take: null },
  );
  const now = new Date();
  const changes = parts.flatMap(
    ({ id, source_missing_since, source_url, identifiers }) => {
      const missing = !identifiers.some(({ normalized_value }) =>
        listedNumbers.has(normalized_value),
      );
      return missing === Boolean(source_missing_since) ||
        (missing && !mayFlag(source_url))
        ? []
        : [{ id, source_missing_since: missing ? now : null }];
    },
  );
  if (changes.length) {
    await catalog.updateParts(changes);
  }
}

async function dropUnlistedOffers(
  suppliers: SupplierModuleService,
  supplierId: string,
  listed: Set<string>,
): Promise<void> {
  const gone = (
    await suppliers.listSupplierOffers(
      { supplier_id: supplierId },
      { select: ['id', 'supplier_article_id'], take: null },
    )
  ).filter(({ supplier_article_id }) => !listed.has(supplier_article_id));
  if (gone.length) {
    await suppliers.deleteSupplierOffers(gone.map(({ id }) => id));
  }
}

// TODO: one query per article; batch the identifier and offer lookups per page once real catalogue sizes make an Import slow.
export async function importSupplier(
  scope: MedusaContainer,
  adapter: SupplierAdapter,
  onPage?: (progress: ImportSummary) => Promise<unknown>,
): Promise<ImportSummary> {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const [supplier] = await suppliers.listSuppliers({ name: adapter.name });
  if (!supplier) {
    throw new Error(`No Supplier is named ${adapter.name}`);
  }
  const context: Context = {
    scope,
    adapter,
    supplierId: supplier.id,
    catalog,
    suppliers,
    ai: shopAi(scope),
    categories: await categoryChoices(catalog),
    logger: scope.resolve(ContainerRegistrationKeys.LOGGER),
    matched: new Set(),
    vehicles: vehicleMatcher(catalog, adapter.name, supplier.id),
    storage: shopStorage(scope),
  };
  if (!context.storage) {
    context.logger.warn(
      `${adapter.name}: S3 is not configured, so AI answers are not cached and every article is asked again`,
    );
  }
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
    skipped_by_reason: {
      brand: 0,
      currency: 0,
      unreadable: 0,
      no_engine_code: 0,
      not_in_scope: 0,
    },
    needs_category: [],
    failed: [],
  };
  const brandOfArticle = (article: Article) =>
    brandOf.get(spellingKey(article.brand));
  const categoryOfArticle = (article: Article) =>
    categoryOf.get(spellingKey(article.category));
  const state: ImportState = {
    summary,
    listed: new Set(),
    listedNumbers: new Set(),
    changedPartIds: new Set(),
  };
  const unreadableUrls = new Set<string>();

  for (let cursor: string | null = null; ;) {
    const page = cataloguePageSchema.parse(await adapter.listCatalogue(cursor));
    for (const { url, reason } of page.unreadable) {
      unreadableUrls.add(url);
      context.logger.warn(
        `${adapter.name}: skipped unreadable ${url}: ${reason}`,
      );
    }
    summary.skipped += page.unreadable.length;
    summary.skipped_by_reason.unreadable += page.unreadable.length;
    summary.skipped += page.not_in_scope;
    summary.skipped_by_reason.not_in_scope += page.not_in_scope;
    for (const { number } of page.articles) {
      state.listedNumbers.add(normalizePartNumber(number));
    }
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
      try {
        await importArticle(
          context,
          state,
          article,
          brandOfArticle(article)!,
          categoryOfArticle(article),
          quotes.get(article.article_id),
        );
      } catch (error) {
        context.logger.warn(
          `Supplier import ${adapter.name}, ${article.number}: failed, ${errorMessage(error)}`,
        );
        summary.failed.push({
          number: article.number,
          reason: errorMessage(error),
        });
        state.listed.add(article.article_id);
      }
    }
    await onPage?.(structuredClone(summary));
    if (!page.next) {
      break;
    }
    cursor = page.next;
  }

  if (unreadableUrls.size) {
    context.logger.warn(
      `${adapter.name}: kept the offers of unlisted articles, ${unreadableUrls.size} pages were unreadable`,
    );
  } else {
    await dropUnlistedOffers(suppliers, supplier.id, state.listed);
  }
  await flagUnlistedParts(
    catalog,
    adapter.name,
    state.listedNumbers,
    unreadableUrls,
  );
  await emitIndexChanges(scope, { partIds: state.changedPartIds });
  return summary;
}

export async function importSupplierCatalogues(
  scope: MedusaContainer,
): Promise<ImportSummary[]> {
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const skipped = new Set(
    (await suppliers.listSuppliers({ import_enabled: false })).map(
      ({ name }) => name,
    ),
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
