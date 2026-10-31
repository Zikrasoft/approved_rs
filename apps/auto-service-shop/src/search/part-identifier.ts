import {
  defineSearchIndex,
  graphConsume,
  graphSeed,
  search,
} from '@medusajs/framework/utils';
import type { SearchTypes } from '@medusajs/framework/types';
import {
  type AttributeValues,
  BRAND_FACET,
  type CatalogLocale,
  facetFilter,
  IN_STOCK,
  IN_STOCK_FACET,
} from '@podbor/catalog-contract';
import { isBuyable } from '@podbor/catalog-contract/availability';

import { serbianScripts } from '../lib/serbian';
import { type CarAddress, fittedCarKeys } from '../lib/car-pages';
import { type PricedOfferRow, storeOffers } from '../modules/supplier/pricing';
import {
  PART_CHANGED_EVENT,
  PART_IDENTIFIER_INDEX,
  PART_IDENTIFIERS_DELETED_EVENT,
  partChangedEventSchema,
  partIdentifiersDeletedEventSchema,
} from './part-changed-event';

export { PART_IDENTIFIER_INDEX };

type Translations = Partial<Record<string, Record<string, string>>> | null;

type NumberRow = {
  id: string;
  part_id: string;
  value: string;
  normalized_value: string;
};

type FacetFieldRow = { key: string; category_id: string };

type OfferRow = PricedOfferRow & { part_identifier_id: string };

type FitmentRow = { part_id: string; vehicle: CarAddress };

type IdentifierRow = {
  id: string;
  value: string;
  superseded: boolean;
  normalized_value: string;
  brand: { name: string; slug: string };
  part: {
    id: string;
    name: string;
    translations: Translations;
    attributes: AttributeValues;
    category_id: string | null;
    category: {
      slug: string;
      name: string;
      translations: Translations;
    } | null;
  };
};

const lower = (text: string | undefined) => text?.toLowerCase();

const names = (
  prefix: string,
  row: { name: string; translations: Translations },
) => {
  const serbian = row.translations?.sr?.name;
  const scripts = serbian ? serbianScripts(serbian) : undefined;
  return {
    [`${prefix}_ru`]: lower(row.name),
    [`${prefix}_sr_latn`]: scripts?.latin,
    [`${prefix}_sr_cyrl`]: scripts?.cyrillic,
    [`${prefix}_en`]: lower(row.translations?.en?.name),
  };
};

const facets = (
  { attributes, category_id }: IdentifierRow['part'],
  facetFields: FacetFieldRow[],
) =>
  facetFields
    .filter(
      ({ key, category_id: fieldCategory }) =>
        fieldCategory === category_id && attributes[key] !== undefined,
    )
    .flatMap(({ key }) =>
      [attributes[key]].flat().map((value) => facetFilter(key, String(value))),
    );

const STANDING = { superseded: 0, unbuyable: 1, buyable: 2 } as const;

const toDocument = (
  row: IdentifierRow,
  siblings: NumberRow[],
  facetFields: FacetFieldRow[],
  offers: OfferRow[],
  published: Set<string>,
  fitments: FitmentRow[],
) => {
  const own = storeOffers(
    offers.filter(({ part_identifier_id }) => part_identifier_id === row.id),
  );
  const [best] = own;
  return {
    id: row.id,
    part_id: row.part.id,
    published: published.has(row.id),
    standing: row.superseded
      ? STANDING.superseded
      : own.some(isBuyable)
        ? STANDING.buyable
        : STANDING.unbuyable,
    brand: row.brand.name,
    number: [row.value, row.normalized_value],
    equivalent_numbers: siblings
      .filter(({ id, part_id }) => part_id === row.part.id && id !== row.id)
      .flatMap(({ value, normalized_value }) => [value, normalized_value]),
    ...names('name', row.part),
    ...(row.part.category
      ? {
          category: row.part.category.slug,
          ...names('category', row.part.category),
        }
      : {}),
    facets: [
      facetFilter(BRAND_FACET, row.brand.slug),
      ...(best?.stock_quantity ? [facetFilter(IN_STOCK_FACET, IN_STOCK)] : []),
      ...facets(row.part, facetFields),
    ],
    price: best?.price,
    cars: [
      ...new Set(
        fitments
          .filter(({ part_id }) => part_id === row.part.id)
          .flatMap(({ vehicle }) => fittedCarKeys(vehicle)),
      ),
    ],
  };
};

const source = {
  fields: [
    'id',
    'value',
    'normalized_value',
    'superseded',
    'brand.name',
    'brand.slug',
    'part.id',
    'part.name',
    'part.translations',
    'part.attributes',
    'part.category_id',
    'part.category.slug',
    'part.category.name',
    'part.category.translations',
  ],
  transform: async (
    rows: IdentifierRow[],
    { container }: SearchTypes.SearchIngestionContext,
  ) => {
    const categoryIds = rows.flatMap(({ part }) =>
      part.category_id ? [part.category_id] : [],
    );
    const [
      { data: siblings },
      { data: facetFields },
      { data: offers },
      { data: published },
      { data: fitments },
    ] = await Promise.all([
      container.query.graph({
        entity: 'part_identifier',
        fields: ['id', 'part_id', 'value', 'normalized_value'],
        filters: { part_id: [...new Set(rows.map(({ part }) => part.id))] },
      }),
      container.query.graph({
        entity: 'category_field',
        fields: ['key', 'category_id'],
        filters: { category_id: [...new Set(categoryIds)], facet: true },
      }),
      container.query.graph({
        entity: 'supplier_offer',
        fields: [
          'id',
          'part_identifier_id',
          'cost_price',
          'currency',
          'stock_quantity',
          'lead_time_days',
          'supplier.markup_percentage',
        ],
        filters: { part_identifier_id: rows.map(({ id }) => id) },
      }),
      container.query.graph({
        entity: 'published_number',
        fields: ['id'],
        filters: { id: rows.map(({ id }) => id) },
      }),
      container.query.graph({
        entity: 'fitment',
        fields: [
          'part_id',
          'vehicle.id',
          'vehicle.model.slug',
          'vehicle.model.chassis.series.make.slug',
        ],
        filters: { part_id: [...new Set(rows.map(({ part }) => part.id))] },
      }),
    ]);
    return rows.map((row) =>
      toDocument(
        row,
        siblings as NumberRow[],
        facetFields as FacetFieldRow[],
        offers as OfferRow[],
        new Set(published.map(({ id }: { id: string }) => id)),
        fitments as FitmentRow[],
      ),
    );
  },
};

const NAME_FIELDS = ['name', 'category'];
const SCRIPTS = ['ru', 'sr_latn', 'sr_cyrl', 'en'];

const localeFields = (locale: CatalogLocale) =>
  locale === 'sr' ? ['sr_latn', 'sr_cyrl'] : [locale];

const text = () => search.text().searchable().retrievable(false);
const numbers = () => search.keyword().array().searchable().retrievable(false);

const fittingFirst = (cars: string[]) =>
  cars.length
    ? [`_eval(cars:=[${cars.map((car) => `\`${car}\``).join(',')}]):desc`]
    : [];

export const searchRanking = (
  locale: CatalogLocale,
  fitting: string[] = [],
) => {
  const own = localeFields(locale);
  const fields: [string, number, number][] = [
    ['number', 15, 0],
    ['brand', 10, 1],
    ...NAME_FIELDS.flatMap((prefix) =>
      own.map((suffix): [string, number, number] => [
        `${prefix}_${suffix}`,
        10,
        2,
      ]),
    ),
    ['equivalent_numbers', 5, 0],
    ...NAME_FIELDS.flatMap((prefix) =>
      SCRIPTS.filter((suffix) => !own.includes(suffix)).map(
        (suffix): [string, number, number] => [`${prefix}_${suffix}`, 2, 2],
      ),
    ),
  ];
  return {
    query_by: fields.map(([field]) => field).join(','),
    query_by_weights: fields.map(([, weight]) => weight).join(','),
    num_typos: fields.map(([, , typos]) => typos).join(','),
    text_match_type: 'max_weight',
    sort_by: [
      ...fittingFirst(fitting),
      '_text_match:desc',
      'standing:desc',
    ].join(','),
  };
};

export default defineSearchIndex({
  name: PART_IDENTIFIER_INDEX,
  entity: 'part_identifier',
  fields: search.define({
    id: search.keyword().filterable().retrievable(),
    part_id: search.keyword().filterable().retrievable(false),
    published: search.boolean().filterable().retrievable(false),
    standing: search.integer().sortable().retrievable(false),
    category: search.keyword().filterable().retrievable(false),
    cars: search.keyword().array().filterable().retrievable(false),
    brand: text(),
    number: numbers(),
    equivalent_numbers: numbers(),
    name_ru: text(),
    name_sr_latn: text(),
    name_sr_cyrl: text(),
    name_en: text(),
    category_ru: text(),
    category_sr_latn: text(),
    category_sr_cyrl: text(),
    category_en: text(),
    facets: search
      .keyword()
      .array()
      .facetable()
      .filterable()
      .retrievable(false),
    price: search
      .integer()
      .filterable()
      .facetable({ types: ['stats'] })
      .retrievable(false),
  }),
  events: [PART_CHANGED_EVENT, PART_IDENTIFIERS_DELETED_EVENT],
  consume: graphConsume({
    ...source,
    resolve_ids: async (event, { container }) => {
      if (event.name === PART_IDENTIFIERS_DELETED_EVENT) {
        return partIdentifiersDeletedEventSchema.parse(event.data).ids;
      }
      const { data } = await container.query.graph({
        entity: 'part_identifier',
        fields: ['id'],
        filters: { part_id: partChangedEventSchema.parse(event.data).part_id },
      });
      return data.map(({ id }: { id: string }) => id);
    },
  }),
  seed: graphSeed(source),
});
