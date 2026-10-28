import type { MedusaContainer } from '@medusajs/framework/types';
import { z } from 'zod';

import { SUPPLIER_MODULE } from '../../modules/supplier';
import { inShopCurrency } from '../../modules/supplier/pricing';
import type SupplierModuleService from '../../modules/supplier/service';
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

// TODO: every page view and cart action calls the supplier; cache quotes for a short window once the Inter Cars rate limits are known (#328).
async function requoteOffers<T extends QuotedOffer>(
  scope: MedusaContainer,
  offers: T[],
): Promise<T[]> {
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const adapters = supplierAdapters(scope);
  const live: T[] = [];
  for (const name of new Set(offers.map(({ supplier }) => supplier.name))) {
    const own = offers.filter(({ supplier }) => supplier.name === name);
    const adapter = adapters.find((candidate) => candidate.name === name);
    if (!adapter) {
      live.push(...own);
      continue;
    }
    const quotes = await liveQuotes(
      adapter.quote,
      own.map(({ supplier_article_id }) => supplier_article_id),
    );
    for (const offer of own) {
      const quote = quotes.get(offer.supplier_article_id);
      if (!quote) {
        continue;
      }
      const fields = quotedFields(quote);
      await suppliers.updateSupplierOffers({ id: offer.id, ...fields });
      live.push({ ...offer, ...fields });
    }
  }
  return live;
}

export async function liveOffers(
  scope: MedusaContainer,
  filters: { id?: string[]; part_identifier_id?: string },
) {
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const offers = await suppliers.listSupplierOffers(filters, {
    relations: ['supplier'],
    take: null,
  });
  return requoteOffers(scope, offers);
}
