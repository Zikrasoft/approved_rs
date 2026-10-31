import type { MedusaContainer } from '@medusajs/framework/types';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../modules/supplier';
import type { PartOffer } from '@podbor/catalog-contract';
import {
  inShopCurrency,
  sellPrice,
  storeOffers,
} from '../../modules/supplier/pricing';
import type SupplierModuleService from '../../modules/supplier/service';
import { parseEnv } from '../env';
import { emitIndexChanges } from '../index-changes';
import { supplierAdapters, supplierQuoteSchema } from './adapter';

type Quote = z.output<typeof supplierQuoteSchema>;

export type QuotedOffer = {
  id: string;
  supplier_article_id: string;
  part_identifier_id: string;
  cost_price: number;
  currency: string;
  stock_quantity: number;
  lead_time_days: number;
  supplier: { name: string; markup_percentage: number };
};

export const quotedFields = (quote: Quote) => ({
  cost_price: quote.cost_price,
  currency: quote.currency,
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
    const quotes = z
      .array(supplierQuoteSchema)
      .parse(await quoteOf(articleIds));
    return new Map(
      quotes.filter(inShopCurrency).map((quote) => [quote.article_id, quote]),
    );
  } catch {
    return new Map();
  }
}

const SELLING_FIELDS = [
  'cost_price',
  'currency',
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

// TODO: in-process, so each server process quotes on its own and a restart forgets every quote; move it to Redis with the server/worker split or once a supplier rate limit needs one shared window (#328).
const recentQuotes = new Map<string, { at: number; quote: Quote | null }>();

const forgetQuotesOlderThan = (cutoff: number) => {
  for (const [offerId, { at }] of recentQuotes) {
    if (at < cutoff) recentQuotes.delete(offerId);
  }
};

async function quotesFor<T extends QuotedOffer>(
  quote: (articleIds: string[]) => Promise<unknown>,
  offers: T[],
  reuseSince: number | null,
): Promise<Map<string, Quote | null>> {
  const stale = offers.filter(
    ({ id }) =>
      reuseSince === null || (recentQuotes.get(id)?.at ?? -1) < reuseSince,
  );
  if (stale.length) {
    const quotes = await liveQuotes(
      quote,
      stale.map(({ supplier_article_id }) => supplier_article_id),
    );
    const at = Date.now();
    for (const { id, supplier_article_id } of stale) {
      recentQuotes.set(id, {
        at,
        quote: quotes.get(supplier_article_id) ?? null,
      });
    }
  }
  return new Map(
    offers.map(({ id }) => [id, recentQuotes.get(id)?.quote ?? null]),
  );
}

async function requoteOffers<T extends QuotedOffer>(
  scope: MedusaContainer,
  offers: T[],
  reuseRecent: boolean,
): Promise<T[]> {
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const adapters = supplierAdapters(scope);
  const live: T[] = [];
  const moved = new Set<string>();
  const window = parseEnv(process.env).LIVE_QUOTE_CACHE_SECONDS * 1000;
  const reuseSince = Date.now() - window;
  forgetQuotesOlderThan(reuseSince);
  for (const name of new Set(offers.map(({ supplier }) => supplier.name))) {
    const own = offers.filter(({ supplier }) => supplier.name === name);
    const adapter = adapters.find((candidate) => candidate.name === name);
    if (!adapter) {
      live.push(...own);
      continue;
    }
    const quotes = await quotesFor(
      adapter.quote,
      own,
      reuseRecent && window > 0 ? reuseSince : null,
    );
    for (const offer of own) {
      const quote = quotes.get(offer.id);
      if (
        !quote ||
        sellPrice(quote.cost_price, offer.supplier.markup_percentage) <= 0
      ) {
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

export async function liveOffers(
  scope: MedusaContainer,
  filters: { id?: string[]; part_identifier_id?: string },
  { reuseRecent = false }: { reuseRecent?: boolean } = {},
) {
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const offers = await suppliers.listSupplierOffers(filters, {
    relations: ['supplier'],
    take: null,
  });
  return requoteOffers(scope, offers, reuseRecent);
}

export const sellingOffers = async (
  scope: MedusaContainer,
  filters: { id?: string[]; part_identifier_id?: string },
  options: { reuseRecent?: boolean } = {},
): Promise<PartOffer[]> =>
  storeOffers(await liveOffers(scope, filters, options));
