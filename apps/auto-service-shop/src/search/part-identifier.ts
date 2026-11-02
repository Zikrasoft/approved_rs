import { container as appContainer } from '@medusajs/framework';
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
  type PartOffer,
} from '@podbor/catalog-contract';
import { isBuyable } from '@podbor/catalog-contract/availability';

import { serbianScripts } from '../lib/serbian';
import { type CarAddress, fittedCarKeys } from '../lib/car-pages';
import { requirementFits } from '../lib/requirement-fit';
import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { offersByIdentifier, type PricedOfferRow } from '../modules/supplier';
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
  superseded: boolean;
};

type FacetFieldRow = { key: string; category_id: string; type: string };

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
    replaced_by_id: string | null;
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

const valuesOf = (
  { attributes, category_id }: IdentifierRow['part'],
  facetFields: FacetFieldRow[],
) =>
  facetFields
    .filter(
      ({ key, category_id: fieldCategory }) =>
        fieldCategory === category_id && attributes[key] !== undefined,
    )
    .map(({ key, type }) => ({ key, type, values: [attributes[key]].flat() }));

const facets = (part: IdentifierRow['part'], facetFields: FacetFieldRow[]) =>
  valuesOf(part, facetFields).flatMap(({ key, values }) =>
    values.map((value) => facetFilter(key, String(value))),
  );

const measures = (part: IdentifierRow['part'], facetFields: FacetFieldRow[]) =>
  valuesOf(part, facetFields)
    .filter(({ type }) => type === 'number')
    .flatMap(({ key, values }) =>
      values
        .map(Number)
        .filter(Number.isFinite)
        .map((value) => ({ key, value })),
    );

type Catalogue = {
  siblings: NumberRow[];
  published: Map<string, boolean>;
};

const facetValues = () =>
  search.keyword().array().facetable().filterable().retrievable(false);

const STANDING = { superseded: 0, unbuyable: 1, buyable: 2 } as const;

const toDocument = (
  row: IdentifierRow,
  catalogue: Catalogue,
  facetFields: FacetFieldRow[],
  own: PartOffer[],
  fitted: CarAddress[],
) => {
  const [best] = own;
  return {
    id: row.id,
    part_id: row.part.id,
    published: catalogue.published.has(row.id),
    listed: catalogue.published.get(row.id) ?? false,
    standing: row.superseded
      ? STANDING.superseded
      : own.some(isBuyable)
        ? STANDING.buyable
        : STANDING.unbuyable,
    brand: row.brand.name,
    number: [row.value, row.normalized_value],
    equivalent_numbers: catalogue.siblings
      .filter(({ id, part_id }) => part_id === row.part.id && id !== row.id)
      .flatMap(({ value, normalized_value }) => [value, normalized_value]),
    ...names('name', row.part),
    ...(row.part.category
      ? {
          category: row.part.category.slug,
          ...names('category', row.part.category),
        }
      : {}),
    universal_facets: [
      facetFilter(BRAND_FACET, row.brand.slug),
      ...(best?.stock_quantity ? [facetFilter(IN_STOCK_FACET, IN_STOCK)] : []),
    ],
    facets: facets(row.part, facetFields),
    measures: measures(row.part, facetFields),
    price: best?.price,
    cars: [...new Set(fitted.flatMap(fittedCarKeys))],
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
    'part.replaced_by_id',
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
    const parts = [
      ...new Map(rows.map(({ part }) => [part.id, part])).values(),
    ];
    const partIds = parts.map(({ id }) => id);
    const [
      { data: siblings },
      { data: facetFields },
      { data: offers },
      { data: fitments },
      { data: published },
      required,
    ] = await Promise.all([
      container.query.graph({
        entity: 'part_identifier',
        fields: ['id', 'part_id', 'value', 'normalized_value', 'superseded'],
        filters: { part_id: partIds },
      }),
      container.query.graph({
        entity: 'category_field',
        fields: ['key', 'category_id', 'type'],
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
        entity: 'fitment',
        fields: [
          'part_id',
          'vehicle.id',
          'vehicle.model.slug',
          'vehicle.model.chassis.series.make.slug',
        ],
        filters: { part_id: partIds },
      }),
      container.query.graph({
        entity: 'published_number',
        fields: ['id', 'listed'],
        filters: { id: rows.map(({ id }) => id) },
      }),
      // TODO: every index batch reloads the cars its Categories' Requirements reach; cache them per reindex once a full reindex gets slow
      requirementFits(
        appContainer.resolve<CatalogModuleService>(CATALOG_MODULE),
        parts,
      ),
    ]);
    const fitted = [...(fitments as FitmentRow[]), ...required];
    const offersOf = offersByIdentifier(offers as OfferRow[]);
    const catalogue: Catalogue = {
      siblings: siblings as NumberRow[],
      published: new Map(
        published.map(({ id, listed }: { id: string; listed: boolean }) => [
          id,
          listed,
        ]),
      ),
    };
    return rows.map((row) =>
      toDocument(
        row,
        catalogue,
        facetFields as FacetFieldRow[],
        offersOf.get(row.id) ?? [],
        fitted
          .filter(({ part_id }) => part_id === row.part.id)
          .map(({ vehicle }) => vehicle),
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
    listed: search.boolean().filterable().retrievable(false),
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
    universal_facets: facetValues(),
    facets: facetValues(),
    measures: search
      .object({
        key: search.keyword().filterable(),
        value: search.float().filterable(),
      })
      .array()
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
