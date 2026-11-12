import type { MedusaContainer } from '@medusajs/framework/types';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import {
  isSellable,
  storeOffers,
  SUPPLIER_MODULE,
} from '../../modules/supplier';
import type { PartOffer } from '@podbor/catalog-contract';
import type SupplierModuleService from '../../modules/supplier/service';
import { parseEnv } from '../env';
import { emitIndexChanges } from '../index-changes';
import {
  parsedQuotes,
  supplierAdapters,
  type supplierQuoteSchema,
} from './adapter';

type Quote = z.output<typeof supplierQuoteSchema>;

export type QuotedOffer = {
  id: string;
  supplier_article_id: string;
  part_identifier_id: string;
  cost_price: number;
  stock_quantity: number;
  lead_time_days: number;
  supplier: { name: string; markup_percentage: number };
};

export const quotedFields = (quote: Quote) => ({
  cost_price: quote.cost_price,
  stock_quantity: quote.stock.reduce((sum, { quantity }) => sum + quantity, 0),
  stock_by_location: Object.fromEntries(
    quote.stock.map(({ location, quantity }) => [location, quantity]),
  ),
  lead_time_days: quote.lead_time_days,
});

async function liveQuotes(
  quoteOf: (articleIds: string[]) => Promise<unknown>,
  articleIds: string[],
): Promise<Map<string, Quote>> {
  try {
    const { quotes } = parsedQuotes(
      z.array(z.unknown()).parse(await quoteOf(articleIds)),
    );
    return new Map(quotes.map((quote) => [quote.article_id, quote]));
  } catch {
    return new Map();
  }
}

const SELLING_FIELDS = [
  'cost_price',
  'stock_quantity',
  'lead_time_days',
] as const;

async function reindexIdentifiers(
  scope: MedusaContainer,
  identifierIds: Set<string>,
): Promise<void> {
  if (!identifierIds.size) {
    return;
  }
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const identifiers = await catalog.listPartIdentifiers(
    { id: [...identifierIds] },
    { select: ['part_id'], take: null },
  );
  await emitIndexChanges(scope, {
    partIds: identifiers.map(({ part_id }) => part_id),
  });
}

export type QuoteCache = ReturnType<typeof createQuoteCache>;

// TODO: in-process, so each server process quotes on its own and a restart forgets every quote; move it to Redis with the server/worker split or once a supplier rate limit needs one shared window (#328).
export function createQuoteCache({
  windowMs,
  now = Date.now,
}: {
  windowMs: number;
  now?: () => number;
}) {
  const recent = new Map<string, { at: number; quote: Quote | null }>();
  return {
    recall(offerId: string): { quote: Quote | null } | undefined {
      const hit = recent.get(offerId);
      return windowMs > 0 && hit && hit.at >= now() - windowMs
        ? hit
        : undefined;
    },
    remember(offerId: string, quote: Quote | null): void {
      const at = now();
      for (const [id, entry] of recent) {
        if (entry.at < at - windowMs) recent.delete(id);
      }
      recent.set(offerId, { at, quote });
    },
  };
}

let processQuotes: QuoteCache | undefined;

const sharedQuotes = (): QuoteCache =>
  (processQuotes ??= createQuoteCache({
    windowMs: parseEnv(process.env).LIVE_QUOTE_CACHE_SECONDS * 1000,
  }));

async function quotesFor<T extends QuotedOffer>(
  quote: (articleIds: string[]) => Promise<unknown>,
  offers: T[],
  cache: QuoteCache,
  reuseRecent: boolean,
): Promise<Map<string, Quote | null>> {
  const known = new Map(
    offers.flatMap(({ id }) => {
      const hit = reuseRecent ? cache.recall(id) : undefined;
      return hit ? [[id, hit.quote] as const] : [];
    }),
  );
  const stale = offers.filter(({ id }) => !known.has(id));
  if (stale.length) {
    const quotes = await liveQuotes(
      quote,
      stale.map(({ supplier_article_id }) => supplier_article_id),
    );
    for (const { id, supplier_article_id } of stale) {
      const fresh = quotes.get(supplier_article_id) ?? null;
      cache.remember(id, fresh);
      known.set(id, fresh);
    }
  }
  return known;
}

async function requoteOffers<T extends QuotedOffer>(
  scope: MedusaContainer,
  offers: T[],
  { reuseRecent, quotes: cache }: QuoteOptions,
): Promise<T[]> {
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const adapters = supplierAdapters(scope);
  const live: T[] = [];
  const moved = new Set<string>();
  for (const name of new Set(offers.map(({ supplier }) => supplier.name))) {
    const own = offers.filter(({ supplier }) => supplier.name === name);
    const adapter = adapters.find((candidate) => candidate.name === name);
    if (!adapter) {
      live.push(...own);
      continue;
    }
    const quotes = await quotesFor(adapter.quote, own, cache, reuseRecent);
    for (const offer of own) {
      const quote = quotes.get(offer.id);
      if (!quote || !isSellable({ ...quote, supplier: offer.supplier })) {
        continue;
      }
      const fields = quotedFields(quote);
      if (SELLING_FIELDS.some((field) => offer[field] !== fields[field])) {
        await suppliers.updateSupplierOffers({ id: offer.id, ...fields });
        moved.add(offer.part_identifier_id);
      }
      live.push({ ...offer, ...fields });
    }
  }
  await reindexIdentifiers(scope, moved);
  return live;
}

type QuoteOptions = { reuseRecent: boolean; quotes: QuoteCache };

export async function liveOffers(
  scope: MedusaContainer,
  filters: { id?: string[]; part_identifier_id?: string },
  { reuseRecent = false, quotes = sharedQuotes() }: Partial<QuoteOptions> = {},
) {
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const offers = await suppliers.listSupplierOffers(filters, {
    relations: ['supplier'],
    take: null,
  });
  return requoteOffers(scope, offers, { reuseRecent, quotes });
}

export const sellingOffers = async (
  scope: MedusaContainer,
  filters: { id?: string[]; part_identifier_id?: string },
  options: Partial<QuoteOptions> = {},
): Promise<PartOffer[]> =>
  storeOffers(await liveOffers(scope, filters, options));
