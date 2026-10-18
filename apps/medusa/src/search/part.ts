import {
  defineSearchIndex,
  graphConsume,
  graphSeed,
  search,
} from '@medusajs/framework/utils';

import { compactValue } from '../modules/search-typesense/mapping';
import { PART_CHANGED_EVENT } from './part-changed-event';

type OfferRow = {
  id: string;
  supplier: string;
  supplier_article_id: string;
  price: number;
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
  fields: [
    'id',
    'name',
    'identifiers.id',
    'identifiers.type',
    'identifiers.brand',
    'identifiers.value',
    'identifiers.offers.id',
    'identifiers.offers.supplier',
    'identifiers.offers.supplier_article_id',
    'identifiers.offers.price',
    'identifiers.offers.stock_quantity',
    'identifiers.offers.lead_time',
  ],
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
          supplier: offer.supplier,
          supplier_article_id: offer.supplier_article_id,
          price: offer.price,
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
    name: search.text().searchable({ weight: 3 }).retrievable(),
    identifiers: identifierFields.array().retrievable(false),
  }),
  events: [PART_CHANGED_EVENT],
  consume: graphConsume({
    ...source,
    resolve_ids: (event) => (event.data as { part_id?: string }).part_id,
  }),
  seed: graphSeed(source),
});
