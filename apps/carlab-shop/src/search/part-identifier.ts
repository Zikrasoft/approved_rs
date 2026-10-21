import {
  defineSearchIndex,
  graphConsume,
  graphSeed,
  search,
} from '@medusajs/framework/utils';
import type { SearchTypes } from '@medusajs/framework/types';
import {
  type AttributeValues,
  type CatalogLocale,
  facetFilter,
} from '@podbor/catalog-contract';

import { serbianScripts } from '../lib/serbian';
import { PART_CHANGED_EVENT } from './part-changed-event';

export const PART_IDENTIFIER_INDEX = 'part_identifier';

type Translations = Partial<Record<string, Record<string, string>>> | null;

type NumberRow = {
  id: string;
  part_id: string;
  value: string;
  normalized_value: string;
};

type FacetFieldRow = { key: string; category_id: string };

type IdentifierRow = {
  id: string;
  value: string;
  normalized_value: string;
  brand: { name: string };
  part: {
    id: string;
    name: string;
    translations: Translations;
    attributes: AttributeValues;
    category_id: string | null;
    category: { name: string; translations: Translations } | null;
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

const toDocument = (
  row: IdentifierRow,
  siblings: NumberRow[],
  facetFields: FacetFieldRow[],
) => ({
  id: row.id,
  part_id: row.part.id,
  brand: row.brand.name,
  number: [row.value, row.normalized_value],
  equivalent_numbers: siblings
    .filter(({ id, part_id }) => part_id === row.part.id && id !== row.id)
    .flatMap(({ value, normalized_value }) => [value, normalized_value]),
  ...names('name', row.part),
  ...(row.part.category ? names('category', row.part.category) : {}),
  facets: facets(row.part, facetFields),
});

const source = {
  fields: [
    'id',
    'value',
    'normalized_value',
    'brand.name',
    'part.id',
    'part.name',
    'part.translations',
    'part.attributes',
    'part.category_id',
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
    const [{ data: siblings }, { data: facetFields }] = await Promise.all([
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
    ]);
    return rows.map((row) =>
      toDocument(row, siblings as NumberRow[], facetFields as FacetFieldRow[]),
    );
  },
};

const NAME_FIELDS = ['name', 'category'];
const SCRIPTS = ['ru', 'sr_latn', 'sr_cyrl', 'en'];

const localeFields = (locale: CatalogLocale) =>
  locale === 'sr' ? ['sr_latn', 'sr_cyrl'] : [locale];

const text = () => search.text().searchable().retrievable(false);
const numbers = () => search.keyword().array().searchable().retrievable(false);

export const searchRanking = (locale: CatalogLocale) => {
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
  };
};

export default defineSearchIndex({
  name: PART_IDENTIFIER_INDEX,
  entity: 'part_identifier',
  fields: search.define({
    id: search.keyword().filterable().retrievable(),
    part_id: search.keyword().filterable().retrievable(false),
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
  }),
  events: [PART_CHANGED_EVENT],
  consume: graphConsume({
    ...source,
    resolve_ids: async (event, { container }) => {
      const { data } = await container.query.graph({
        entity: 'part_identifier',
        fields: ['id'],
        filters: { part_id: (event.data as { part_id: string }).part_id },
      });
      return data.map(({ id }: { id: string }) => id);
    },
  }),
  seed: graphSeed(source),
});
