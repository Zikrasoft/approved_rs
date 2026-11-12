import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import {
  type AttributeValues,
  STAGED_DATA_KINDS,
  validateAttributes,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import type {
  FoundPart,
  PartClassification,
} from '../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../modules/supplier';
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
import { plainDescription } from '../ai/description';
import {
  cataloguePageSchema,
  parsedQuotes,
  type SupplierAdapter,
  supplierAdapters,
  type supplierQuoteSchema,
} from './adapter';
import { parseEnv } from '../env';
import { crawledPartType, START_STOP } from '../production-seed';
import { batteryName, isBattery } from './part-name';
import { errorMessage } from '../errors';
import { emitIndexChanges } from '../index-changes';
import { shopStorage, type ShopStorage } from '../storage';
import { mirroredImage } from './mirrored-images';
import { quotedFields } from './live-quote';
import { nameKey, normalizePartNumber } from '../../modules/_shared/keys';
import { partNumberKey } from '../../modules/_shared/part-number-key';
import { categoryScope } from './category-scope';
import {
  type ImportSummary,
  importTally,
  type ImportTally,
} from './import-summary';
import { fitVehicles, type VehicleMatcher, vehicleMatcher } from './vehicles';

type Article = z.output<typeof cataloguePageSchema>['articles'][number];
type Quote = z.output<typeof supplierQuoteSchema>;

export type { ImportSummary };

type ImportState = {
  tally: ImportTally;
  listed: Set<string>;
  listedBrandNumbers: Set<string>;
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
  summary: ImportSummary;
  descriptions: Set<string>;
  oneAtATime: <T>(run: () => Promise<T>) => Promise<T>;
};

const MOST_FITTED = 6;

const PROGRESS_EVERY = 10;

const mostFitted = ({ vehicles = [] }: Article) => {
  const counts = new Map<string, number>();
  for (const { make, model } of vehicles) {
    const car = `${make} ${model}`;
    counts.set(car, (counts.get(car) ?? 0) + 1);
  }
  return [...counts]
    .sort(([, a], [, b]) => b - a)
    .slice(0, MOST_FITTED)
    .map(([car]) => car);
};

const factsOf = (article: Article): ArticleFacts => ({
  name: article.name,
  brand: article.brand,
  number: article.number,
  description: article.description ?? null,
  specs: article.specs ?? {},
  fits: mostFitted(article),
});

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

const categoryOf = ({ categories }: Context, id: string | null) =>
  categories.find((category) => category.id === id) ?? null;

async function answerOf(
  context: Context,
  article: Article,
  categoryId: string | null,
): Promise<ArticleAnswer | null> {
  try {
    return await cachedArticleAnswer(
      context.ai,
      context.storage?.pages ?? null,
      factsOf(article),
      categoryOf(context, categoryId),
    );
  } catch (error) {
    const reason = errorMessage(error);
    context.logger.warn(
      `Supplier import ${context.adapter.key}, ${article.number}: AI failed, ${reason}`,
    );
    context.summary.unanswered.push({ number: article.number, reason });
    return null;
  }
}

const lazily = <T>(run: () => Promise<T>) => {
  let running: Promise<T> | undefined;
  return () => (running ??= run());
};

const fittingAttributes = (
  fields: CategoryFieldChoice[],
  values: AttributeValues,
): AttributeValues =>
  Object.fromEntries(
    Object.entries(values).filter(([key, value]) => {
      const field = fields.find((candidate) => candidate.key === key);
      return (
        field &&
        validateAttributes([{ ...field, required: true }], { [key]: value })
          .success
      );
    }),
  );

const withStartStop = (
  fields: CategoryFieldChoice[],
  attributes: AttributeValues,
): AttributeValues => {
  const technology = attributes[START_STOP.technologyField];
  const derivable =
    fields.some(
      ({ key, type }) => key === START_STOP.field && type === 'boolean',
    ) &&
    attributes[START_STOP.field] === undefined &&
    typeof technology === 'string';
  return derivable
    ? {
        ...attributes,
        [START_STOP.field]: START_STOP.technologies.includes(technology),
      }
    : attributes;
};

const withBrandAndNumber = (name: string, { brand, number }: Article) =>
  normalizePartNumber(name)?.includes(partNumberKey(number))
    ? name
    : `${name} ${brand} ${number}`;

const composedName = (
  context: Context,
  article: Article,
  categoryId: string | null,
  attributes: Readonly<Record<string, unknown>>,
) => {
  if (isBattery(categoryOf(context, categoryId)?.fields ?? [])) {
    return batteryName(attributes, article.brand, article.number);
  }
  const type = crawledPartType(context.adapter.key, article.category);
  return type && `${type} ${article.brand} ${article.number}`;
};

function classificationOf(
  context: Context,
  article: Article,
  categoryId: string | null,
  answer: ArticleAnswer | null,
): PartClassification {
  const category = categoryOf(context, categoryId);
  const fields = category?.fields ?? [];
  const attributes =
    answer && article.specs
      ? withStartStop(fields, fittingAttributes(fields, answer.attributes))
      : {};
  const missing = fields.filter(
    ({ key, required }) => required && !(key in attributes),
  );
  if (category && missing.length) {
    context.summary.missing_fields.push({
      number: article.number,
      category: category.name,
      fields: missing.map(({ label }) => label),
    });
    return { category_id: null, attributes: {} };
  }
  return { category_id: category?.id ?? null, attributes };
}

const descriptionOf = async (
  { catalog, descriptions }: Context,
  article: Article,
  name: string,
  answer: ArticleAnswer | null,
) => {
  const written =
    article.description || article.specs ? answer?.description : null;
  if (!written) return null;
  const plain = plainDescription(written, name);
  if (!plain) return null;
  for (const text of [plain, `${name}.\n\n${plain}`]) {
    if (descriptions.has(text)) continue;
    descriptions.add(text);
    const taken = await catalog.listParts(
      { description: text },
      { select: ['id'], take: 1 },
    );
    if (!taken.length) return text;
  }
  return null;
};

const refusedAttributes = (error: unknown) =>
  MedusaError.isMedusaError(error) && error.code === 'INVALID_ATTRIBUTES';

async function createPart(
  context: Context,
  article: Article,
  brandId: string,
  categoryId: string,
): Promise<FoundPart> {
  const { adapter, catalog } = context;
  const answer = await answerOf(context, article, categoryId);
  const classification = classificationOf(context, article, categoryId, answer);
  const composed = composedName(
    context,
    article,
    classification.category_id,
    classification.attributes,
  );
  const name =
    composed ??
    (answer ? withBrandAndNumber(answer.name, article) : article.name);
  const part = {
    name,
    source_name: composed || answer ? article.name : null,
    description: await descriptionOf(context, article, name, answer),
    identifier: {
      type: 'manufacturer-number' as const,
      brand_id: brandId,
      value: article.number,
    },
    source: adapter.key,
    source_url: article.source_url ?? null,
  };
  const create = (attempt: Partial<PartClassification>) =>
    catalog.findOrCreatePart({ ...part, ...attempt });
  return create(classification).catch((error: unknown) => {
    if (!refusedAttributes(error)) throw error;
    return create({});
  });
}

async function matchArticle(
  context: Context,
  article: Article,
  brandId: string,
  categoryId: string,
): Promise<{
  identifierId: string;
  partId: string;
  created: boolean;
  changedPartId?: string;
} | null> {
  const { adapter, catalog } = context;
  const [hit] = await catalog.listPartIdentifiers(
    {
      brand_id: brandId,
      normalized_value: partNumberKey(article.number),
    },
    { relations: ['part'], take: 1 },
  );
  if (!hit) {
    if (await catalog.isRejectedNumber(brandId, article.number)) return null;
    const found = await createPart(context, article, brandId, categoryId);
    return {
      identifierId: found.part_identifier_id,
      partId: found.part_id,
      created: found.created,
      ...(found.created && { changedPartId: found.part_id }),
    };
  }
  const { part } = hit;
  const unchanged = { identifierId: hit.id, partId: part.id, created: false };
  if (part.source !== adapter.key) {
    return unchanged;
  }
  if (article.source_url && part.source_url !== article.source_url) {
    await catalog.updateParts({ id: part.id, source_url: article.source_url });
  }
  const edited = new Set(part.edited_fields);
  const fileable = !part.category_id && !edited.has('category_id');
  const classifiedUnder = part.category_id ?? (fileable ? categoryId : null);
  const answer = lazily(() => answerOf(context, article, classifiedUnder));
  const refreshable =
    Boolean(part.category_id) &&
    !edited.has('attributes') &&
    Boolean(article.specs) &&
    Boolean(categoryOf(context, part.category_id)?.fields?.length);
  const classification =
    fileable || (refreshable && (await answer()))
      ? classificationOf(context, article, classifiedUnder, await answer())
      : undefined;
  const nameable = !edited.has('name') && !context.matched.has(hit.id);
  const composed = nameable
    ? composedName(
        context,
        article,
        classification?.category_id ?? part.category_id,
        classification?.attributes ?? part.attributes ?? {},
      )
    : null;
  const renaming =
    composed || !nameable || part.source_name === article.name
      ? null
      : await answer();
  const name =
    (composed !== part.name && composed) ||
    (renaming && withBrandAndNumber(renaming.name, article));
  const description =
    edited.has('description') || part.description
      ? null
      : await descriptionOf(
          context,
          article,
          name || part.name,
          await answer(),
        );
  if (!classification && !name && !description) {
    return unchanged;
  }
  const { changed } = await catalog.applySourceChange(part.id, {
    ...(name && { name, source_name: article.name }),
    ...(description && { description }),
    classification,
  });
  return { ...unchanged, ...(changed && { changedPartId: part.id }) };
}

async function storeOffer(
  { supplierId, suppliers }: Context,
  identifierId: string,
  quote: Quote,
): Promise<boolean> {
  const { changed } = await suppliers.upsertSupplierOffer({
    supplier_id: supplierId,
    supplier_article_id: quote.article_id,
    part_identifier_id: identifierId,
    ...quotedFields(quote),
  });
  return changed;
}

async function stagedImages(
  { scope, storage, logger, summary }: Context,
  images: string[],
): Promise<{ items: string[]; sources?: Record<string, string> }> {
  if (!storage) return { items: images };
  const sources: Record<string, string> = {};
  for (const source of images) {
    const mirrored = await mirroredImage(scope, storage, source, logger);
    if (mirrored) sources[mirrored] ??= source;
    else summary.images_failed += 1;
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
  { tally, listed, changedPartIds }: ImportState,
  article: Article,
  brandId: string,
  categoryId: string,
  quote: Quote | undefined,
): Promise<void> {
  const match = await matchArticle(context, article, brandId, categoryId);
  if (!match) {
    tally.skip('rejected');
    return;
  }
  const { identifierId, partId, created, changedPartId } = match;
  context.matched.add(identifierId);
  if (changedPartId) {
    changedPartIds.add(changedPartId);
  }
  const offerChanged = quote
    ? await storeOffer(context, identifierId, quote)
    : false;
  if (quote) {
    if (offerChanged) {
      changedPartIds.add(partId);
    }
    listed.add(article.article_id);
  }
  await stage(context, identifierId, article);
  if (article.vehicles) {
    const vehicles = article.vehicles;
    const { unknownMakes } = await context.oneAtATime(() =>
      fitVehicles(context.vehicles, partId, vehicles),
    );
    for (const make of unknownMakes) tally.unknownMake(make);
    tally.withoutEngineCode(
      article.vehicles.filter(({ engine_codes }) => !engine_codes.length)
        .length,
    );
  }
  tally.imported(
    created
      ? 'created'
      : changedPartId || offerChanged
        ? 'updated'
        : 'unchanged',
  );
}

const oneAtATime = () => {
  let last: Promise<unknown> = Promise.resolve();
  return <T>(run: () => Promise<T>): Promise<T> => {
    const next = last.then(run);
    last = next.catch(() => undefined);
    return next;
  };
};

async function eachAtOnce<T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) {
        await run(queue.shift()!);
      }
    }),
  );
}

const listedKey = (brandId: string, { number }: Article) =>
  `${brandId} ${partNumberKey(number)}`;

const sameNumberRuns = (
  articles: Article[],
  brandOf: (article: Article) => string | undefined,
): Article[][] => {
  const runs = new Map<string, Article[]>();
  for (const article of articles) {
    const key = `${brandOf(article)} ${partNumberKey(article.number)}`;
    runs.set(key, [...(runs.get(key) ?? []), article]);
  }
  return [...runs.values()];
};

// TODO: one query per article; batch the identifier and offer lookups per page once real catalogue sizes make an Import slow.
export async function importSupplier(
  scope: MedusaContainer,
  adapter: SupplierAdapter,
  onProgress?: (progress: ImportSummary) => Promise<unknown>,
): Promise<ImportSummary> {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const { IMPORT_CONCURRENCY } = parseEnv(process.env);
  const supplier = await suppliers.supplierByKey(adapter.key);
  if (!supplier) {
    throw new Error(`No Supplier has the key ${adapter.key}`);
  }
  const tally = importTally(supplier.name);
  const { summary } = tally;
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
    vehicles: vehicleMatcher(catalog, adapter.key, supplier.id),
    storage: shopStorage(scope),
    summary,
    descriptions: new Set(),
    oneAtATime: oneAtATime(),
  };
  if (!context.storage) {
    context.logger.warn(
      `${adapter.key}: S3 is not configured, so AI answers are not cached and every article is asked again`,
    );
  }
  const scopeOf = categoryScope(
    await suppliers.listSupplierCategories(
      { supplier_id: supplier.id },
      { select: ['code', 'category_id'], take: null },
    ),
  );
  const brandOf = new Map(
    (
      await catalog.listBrandSpellings(
        { supplier_id: supplier.id },
        { take: null },
      )
    ).map(({ value_key, brand_id }) => [value_key, brand_id]),
  );
  const brandOfArticle = (article: Article) =>
    brandOf.get(nameKey(article.brand));
  const state: ImportState = {
    tally,
    listed: new Set(),
    listedBrandNumbers: new Set(),
    changedPartIds: new Set(),
  };
  const categoryOfArticle = new Map<Article, string>();
  const inScope = (article: Article) => {
    const decision = scopeOf(article.category);
    if ('categoryId' in decision) {
      categoryOfArticle.set(article, decision.categoryId);
      return true;
    }
    if (decision.skipped === 'unmapped') tally.unmapped(article.category);
    else tally.skip('excluded');
    return false;
  };
  const unreadableUrls = new Set<string>();
  let reported: Promise<unknown> = Promise.resolve();
  const report = () =>
    (reported = reported.then(() => onProgress?.(structuredClone(summary))));
  let handled = 0;

  for (let cursor: string | null = null; ;) {
    const page = cataloguePageSchema.parse(await adapter.listCatalogue(cursor));
    for (const { url, reason } of page.unreadable) {
      unreadableUrls.add(url);
      context.logger.warn(
        `${adapter.key}: skipped unreadable ${url}: ${reason}`,
      );
    }
    tally.skip('unreadable', page.unreadable.length);
    tally.skip('not_in_scope', page.not_in_scope);
    const branded = page.articles.filter(brandOfArticle);
    const numbered = branded.filter(({ number }) =>
      normalizePartNumber(number),
    );
    for (const article of numbered) {
      state.listedBrandNumbers.add(
        listedKey(brandOfArticle(article)!, article),
      );
    }
    tally.skip('brand', page.articles.length - branded.length);
    tally.skip('no_number', branded.length - numbered.length);
    const wanted = numbered.filter(inScope);
    const { quotes: quoted, refused } = wanted.length
      ? parsedQuotes(
          z
            .array(z.unknown())
            .parse(
              await adapter.quote(wanted.map(({ article_id }) => article_id)),
            ),
        )
      : { quotes: [], refused: 0 };
    const quotes = new Map(quoted.map((quote) => [quote.article_id, quote]));
    tally.skip('currency', refused);
    const importOne = async (article: Article) => {
      try {
        await importArticle(
          context,
          state,
          article,
          brandOfArticle(article)!,
          categoryOfArticle.get(article)!,
          quotes.get(article.article_id),
        );
      } catch (error) {
        context.logger.warn(
          `Supplier import ${adapter.key}, ${article.number}: failed, ${errorMessage(error)}`,
        );
        summary.failed.push({
          number: article.number,
          reason: errorMessage(error),
        });
        state.listed.add(article.article_id);
      }
      handled += 1;
      if (handled % PROGRESS_EVERY === 0) await report();
    };
    await eachAtOnce(
      sameNumberRuns(wanted, brandOfArticle),
      IMPORT_CONCURRENCY,
      async (run) => {
        for (const article of run) await importOne(article);
      },
    );
    await report();
    if (!page.next) {
      break;
    }
    cursor = page.next;
  }

  if (unreadableUrls.size) {
    context.logger.warn(
      `${adapter.key}: kept the offers of unlisted articles, ${unreadableUrls.size} pages were unreadable`,
    );
  } else {
    const dropped = await suppliers.dropUnlistedOffers(supplier.id, [
      ...state.listed,
    ]);
    const droppedFrom = dropped.length
      ? await catalog.listPartIdentifiers(
          { id: dropped },
          { select: ['part_id'], take: null },
        )
      : [];
    for (const { part_id } of droppedFrom) {
      state.changedPartIds.add(part_id);
    }
  }
  await catalog.flagUnlistedParts(
    adapter.key,
    [...state.listedBrandNumbers],
    [...unreadableUrls],
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
      ({ key }) => key,
    ),
  );
  const summaries: ImportSummary[] = [];
  for (const adapter of supplierAdapters(scope)) {
    if (skipped.has(adapter.key)) {
      continue;
    }
    summaries.push(await importSupplier(scope, adapter));
  }
  return summaries;
}
