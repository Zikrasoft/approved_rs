import {
  defineSearchIndex,
  graphConsume,
  graphSeed,
  search,
} from '@medusajs/framework/utils';

import { PART_WITH_OFFERS_FIELDS } from '../lib/store-response';
import { compactValue } from '../modules/search-typesense/mapping';
import { sellPrice } from '../modules/supplier/pricing';
import { PART_CHANGED_EVENT } from './part-changed-event';

type OfferRow = {
  id: string;
  supplier: { name: string; markup_percentage: number };
  supplier_article_id: string;
  cost_price: number;
  stock_quantity: number;
  lead_time: string;
};

type IdentifierRow = {
  id: string;
  type: string;
  brand: string;
  value: string;
  offers?: OfferRow[];
};

type PartRow = {
  id: string;
  name: string;
  identifiers?: IdentifierRow[];
};

const source = {
  fields: PART_WITH_OFFERS_FIELDS,
  transform: (rows: PartRow[]) =>
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      identifiers: (row.identifiers ?? []).map((identifier) => ({
        id: identifier.id,
        type: identifier.type,
        brand: identifier.brand,
        value: identifier.value,
        value_compact: compactValue(identifier.value),
        offers: (identifier.offers ?? []).map((offer) => ({
          id: offer.id,
          supplier: offer.supplier.name,
          supplier_article_id: offer.supplier_article_id,
          price: sellPrice(offer.cost_price, offer.supplier.markup_percentage),
          stock_quantity: offer.stock_quantity,
          lead_time: offer.lead_time,
        })),
      })),
    })),
};

const offerFields = search.object({
  id: search.keyword().retrievable(false),
  supplier: search.keyword().retrievable(false),
  supplier_article_id: search.keyword().retrievable(false),
  price: search.float().retrievable(false),
  stock_quantity: search.integer().retrievable(false),
  lead_time: search.keyword().retrievable(false),
});

const identifierFields = search.object({
  id: search.keyword().retrievable(false),
  type: search.keyword().retrievable(false),
  brand: search.keyword().retrievable(false),
  value: search.text().searchable().retrievable(false),
  value_compact: search.keyword().searchable().retrievable(false),
  offers: offerFields.array().retrievable(false),
});

export default defineSearchIndex({
  name: 'part',
  entity: 'part',
  fields: search.define({
    id: search.keyword().filterable().retrievable(),
    name: search.text().searchable({ weight: 3 }).retrievable(false),
    identifiers: identifierFields.array().retrievable(false),
  }),
  events: [PART_CHANGED_EVENT],
  consume: graphConsume({
    ...source,
    resolve_ids: (event) => (event.data as { part_id?: string }).part_id,
  }),
  seed: graphSeed(source),
});
