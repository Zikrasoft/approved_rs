import type { MedusaContainer } from '@medusajs/framework/types';
import { MedusaError } from '@medusajs/framework/utils';
import {
  normalizePartNumber,
  STAGED_DATA_KINDS,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../modules/supplier';
import { inShopCurrency } from '../../modules/supplier/pricing';
import type SupplierModuleService from '../../modules/supplier/service';
import {
  cataloguePageSchema,
  type SupplierAdapter,
  supplierAdapters,
  supplierQuoteSchema,
} from './adapter';
import { quotedFields } from './live-quote';
import { spellingKey } from './spelling';

type Article = z.output<typeof cataloguePageSchema>['articles'][number];
type Quote = z.output<typeof supplierQuoteSchema>;

export type ImportSummary = {
  supplier: string;
  imported: number;
  created: number;
  skipped: number;
  skipped_by_reason: { category: number; brand: number; currency: number };
};

type Context = {
  adapter: SupplierAdapter;
  supplierId: string;
  catalog: CatalogModuleService;
  suppliers: SupplierModuleService;
};

async function createPart(
  { adapter, catalog }: Context,
  article: Article,
  brandId: string,
  categoryId: string,
): Promise<string> {
  const part = {
    name: article.name,
    identifiers: [
      {
        type: 'manufacturer-number' as const,
        brand_id: brandId,
        value: article.number,
      },
    ],
    source: adapter.name,
  };
  const partId = await catalog
    .createPartWithIdentifiers({ ...part, category_id: categoryId })
    .catch((error: unknown) => {
      if (
        error instanceof MedusaError &&
        error.type === MedusaError.Types.INVALID_DATA
      ) {
        return catalog.createPartWithIdentifiers(part);
      }
      throw error;
    });
  const [identifier] = await catalog.listPartIdentifiers({ part_id: partId });
  return identifier.id;
}

async function matchArticle(
  context: Context,
  article: Article,
  brandId: string,
  categoryId: string,
): Promise<{ identifierId: string; created: boolean }> {
  const { adapter, catalog } = context;
  const [hit] = await catalog.listPartIdentifiers(
    {
      brand_id: brandId,
      normalized_value: normalizePartNumber(article.number),
    },
    { relations: ['part'], take: 1 },
  );
  if (!hit) {
    return {
      identifierId: await createPart(context, article, brandId, categoryId),
      created: true,
    };
  }
  const { part } = hit;
  if (
    part.source === adapter.name &&
    !part.updated_by &&
    part.name !== article.name
  ) {
    await catalog.updateParts({ id: part.id, name: article.name });
  }
  return { identifierId: hit.id, created: false };
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
    if (items.length === 0) {
      continue;
    }
    const [existing] = await suppliers.listStagedRecords({
      supplier_id: supplierId,
      part_identifier_id: identifierId,
      kind,
    });
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

// TODO: one query per article; batch the identifier and offer lookups per page once real catalogue sizes make the nightly run slow.
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
  };
  const categoryOf = new Map(
    (
      await suppliers.listSupplierCategories(
        { supplier_id: supplier.id },
        { take: null },
      )
    ).map(({ code, category_id }) => [code, category_id]),
  );
  const brandOf = new Map(
    (
      await catalog.listBrandSpellings(
        { supplier_id: supplier.id },
        { take: null },
      )
    ).map(({ value, brand_id }) => [spellingKey(value), brand_id]),
  );
  const summary: ImportSummary = {
    supplier: adapter.name,
    imported: 0,
    created: 0,
    skipped: 0,
    skipped_by_reason: { category: 0, brand: 0, currency: 0 },
  };
  const brandOfArticle = (article: Article) =>
    brandOf.get(spellingKey(article.brand));
  const listed = new Set<string>();

  for (let cursor: string | null = null; ;) {
    const page = cataloguePageSchema.parse(await adapter.listCatalogue(cursor));
    const unmapped = page.articles.filter(
      (article) => !categoryOf.has(article.category),
    );
    const unbranded = page.articles.filter(
      (article) => categoryOf.has(article.category) && !brandOfArticle(article),
    );
    const wanted = page.articles.filter(
      (article) => categoryOf.has(article.category) && brandOfArticle(article),
    );
    summary.skipped += unmapped.length + unbranded.length;
    summary.skipped_by_reason.category += unmapped.length;
    summary.skipped_by_reason.brand += unbranded.length;
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
      const { identifierId, created } = await matchArticle(
        context,
        article,
        brandOfArticle(article)!,
        categoryOf.get(article.category)!,
      );
      const quote = quotes.get(article.article_id);
      if (quote) {
        await storeOffer(context, identifierId, quote);
        listed.add(article.article_id);
      }
      await stage(context, identifierId, article);
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
  return summary;
}

export async function importSupplierCatalogues(
  scope: MedusaContainer,
): Promise<ImportSummary[]> {
  const summaries: ImportSummary[] = [];
  for (const adapter of supplierAdapters(scope)) {
    summaries.push(await importSupplier(scope, adapter));
  }
  return summaries;
}
