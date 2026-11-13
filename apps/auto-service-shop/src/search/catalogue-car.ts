import { container } from '@medusajs/framework';
import { defineSearchIndex, search } from '@medusajs/framework/utils';
import type {
  ISearchModuleService,
  SearchTypes,
} from '@medusajs/framework/types';
import {
  type CarHit,
  type CarKind,
  makeHasPage,
  type PlaceParts,
  seriesHasPage,
} from '@podbor/catalog-contract';

import {
  CATALOGUE_CAR_INDEX,
  makeKey,
  readCarHit,
  seriesKey,
} from '../lib/car-pages';
import { everyRequirementFit } from '../lib/requirement-fit';
import { serbianScripts } from '../lib/serbian';
import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { PUBLISH_MODULE } from '../modules/publish';
import type PublishModuleService from '../modules/publish/service';
import type { ListedPartCount } from '../modules/publish/service';

const MAX_QUERY_TOKENS = 8;
const HITS_PER_TOKEN = 100;
const CARS_SHOWN = 8;
const BREADTH: Record<CarKind, number> = {
  make: 3,
  series: 2,
  model: 1,
  vehicle: 0,
};

type MakeRow = { slug: string; name: string; spellings: { value: string }[] };

type VehicleRow = {
  id: string;
  engine: { code: string; family: string } | null;
  model: {
    name: string;
    chassis: {
      code: string;
      series: {
        id: string;
        name: string;
        translations: Record<string, Record<string, string>> | null;
        make: MakeRow;
      };
    };
  };
};

export type PartCounts = Map<string, PlaceParts>;

const NO_PARTS: PlaceParts = { parts: 0, required: 0 };

export const searchTokens = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const RUSSIAN_LETTERS: Record<string, string> = {
  a: 'а',
  b: 'б',
  c: 'ц',
  d: 'д',
  e: 'е',
  f: 'ф',
  g: 'г',
  h: 'х',
  i: 'и',
  j: 'й',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'к',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  w: 'в',
  x: 'х',
  y: 'и',
  z: 'з',
};

const russianSpelling = (text: string) =>
  [...text.toLowerCase()]
    .map((letter) => RUSSIAN_LETTERS[letter] ?? letter)
    .join('');

const termsOf = (...texts: (string | null | undefined)[]): string[] =>
  texts.flatMap((text) => {
    if (!text) return [];
    const { latin, cyrillic } = serbianScripts(text);
    return [text, latin, cyrillic, russianSpelling(latin)].flatMap(
      searchTokens,
    );
  });

const makeOf = ({ model }: VehicleRow) => model.chassis.series.make.slug;
const seriesOf = ({ model }: VehicleRow) => model.chassis.series.id;

const groupBy = (
  vehicles: VehicleRow[],
  key: (vehicle: VehicleRow) => string,
) => {
  const groups = new Map<string, VehicleRow[]>();
  for (const vehicle of vehicles) {
    groups.set(key(vehicle), [...(groups.get(key(vehicle)) ?? []), vehicle]);
  }
  return [...groups.values()];
};

export function carsWithPages(vehicles: VehicleRow[], counts: PartCounts) {
  const series = groupBy(vehicles, seriesOf).filter(([row]) =>
    seriesHasPage(counts.get(seriesOf(row)) ?? NO_PARTS),
  );
  return {
    makes: groupBy(series.flat(), makeOf)
      .filter((rows) => makeHasPage(groupBy(rows, seriesOf).length))
      .map(([row]) => row),
    series,
  };
}

const makeCard = ({ slug, name }: MakeRow) => ({ slug, name });

const document = (
  id: string,
  kind: CarKind,
  terms: string[],
  card: object,
) => ({
  id,
  breadth: BREADTH[kind],
  terms: [...new Set(terms)],
  card: JSON.stringify({ kind, ...card }),
});

export function carDocuments(vehicles: VehicleRow[], counts: PartCounts) {
  const paged = carsWithPages(vehicles, counts);
  const makeTerms = ({ model }: VehicleRow) => {
    const { make } = model.chassis.series;
    return termsOf(make.name, ...make.spellings.map(({ value }) => value));
  };
  const carTerms = ({ model, engine }: VehicleRow) =>
    termsOf(model.chassis.code, model.name, engine?.code, engine?.family);
  const make = (row: VehicleRow) => makeCard(row.model.chassis.series.make);
  return [
    ...paged.makes.map((row) =>
      document(makeKey(makeOf(row)), 'make', makeTerms(row), {
        make: make(row),
        series: null,
        model: null,
        vehicle: null,
      }),
    ),
    ...paged.series.map((rows) => {
      const [row] = rows;
      const { series } = row.model.chassis;
      return document(
        seriesKey(series),
        'series',
        [
          ...makeTerms(row),
          ...termsOf(
            series.name,
            series.translations?.sr?.name,
            series.translations?.en?.name,
          ),
          ...rows.flatMap(carTerms),
        ],
        {
          make: make(row),
          series: { name: series.name, translations: series.translations },
          model: null,
          vehicle: null,
        },
      );
    }),
  ];
}

const VEHICLE_FIELDS = [
  'id',
  'engine.code',
  'engine.family',
  'model.name',
  'model.chassis.code',
  'model.chassis.series.id',
  'model.chassis.series.name',
  'model.chassis.series.translations',
  'model.chassis.series.make.slug',
  'model.chassis.series.make.name',
  'model.chassis.series.make.spellings.value',
];

const partCountsOf = (rows: ListedPartCount[]): PartCounts =>
  new Map(
    rows.map(({ series_id, parts, required }) => [
      series_id,
      { parts, required },
    ]),
  );

async function* seed({
  container: { query },
  catchup,
}: SearchTypes.SearchSeedContext) {
  if (catchup) {
    return;
  }
  const [{ data: vehicles }, counts] = await Promise.all([
    query.graph({ entity: 'vehicle', fields: VEHICLE_FIELDS }),
    everyRequirementFit(container.resolve<CatalogModuleService>(CATALOG_MODULE))
      .then((fits) =>
        container
          .resolve<PublishModuleService>(PUBLISH_MODULE)
          .listedPartCounts(fits),
      )
      .then(partCountsOf),
  ]);
  const documents = carDocuments(vehicles as VehicleRow[], counts);
  if (documents.length) {
    yield [{ action: 'upsert' as const, documents }];
  }
}

const HAS_LETTER = /\p{L}/u;

export type CarMatch = { cars: CarHit[]; keys: string[]; rest: string[] };

export async function matchCars(
  searchModule: ISearchModuleService,
  q: string,
): Promise<CarMatch> {
  const typed = searchTokens(q);
  const tokens = typed.slice(0, MAX_QUERY_TOKENS);
  const last = tokens.length - 1;
  const answers = await searchModule.searchMany(
    tokens.map((token, index) => ({
      entity: CATALOGUE_CAR_INDEX,
      fields: ['id', 'terms', 'card'],
      filters: { q: token },
      pagination: { skip: 0, take: HITS_PER_TOKEN },
      search_options: {
        provider_options: {
          typesense: {
            query_by: 'terms',
            num_typos: 0,
            prefix: index === last,
            drop_tokens_threshold: 0,
            sort_by: '_text_match:desc,breadth:desc',
          },
        },
      },
    })),
  );
  const hits = new Map(
    answers
      .flatMap(({ hits: found }) => found)
      .flatMap(({ document: found }) => readCarHit(found))
      .map((hit) => [hit.id, hit]),
  );
  const covers = (terms: string[], token: string, index: number) =>
    terms.includes(token) ||
    (index === last &&
      token.length >= 2 &&
      terms.some((term) => term.startsWith(token)));
  const scored = [...hits.values()].map((hit) => {
    const covered = tokens.filter((token, index) =>
      covers(hit.terms, token, index),
    );
    return {
      ...hit,
      covered: covered.some((token) => HAS_LETTER.test(token)) ? covered : [],
    };
  });
  const best = Math.max(0, ...scored.map(({ covered }) => covered.length));
  const top = scored
    .filter(({ covered }) => best > 0 && covered.length === best)
    .sort((a, b) => BREADTH[b.card.kind] - BREADTH[a.card.kind]);
  const covered = new Set(top.flatMap((hit) => hit.covered));
  const broadest = top[0] ? BREADTH[top[0].card.kind] : 0;
  return {
    cars: top.slice(0, CARS_SHOWN).map(({ card }) => card),
    keys: top
      .filter(({ card }) => BREADTH[card.kind] === broadest)
      .map(({ id }) => id),
    rest: typed.filter((token) => !covered.has(token)),
  };
}

export default defineSearchIndex({
  name: CATALOGUE_CAR_INDEX,
  entity: 'vehicle',
  fields: search.define({
    id: search.keyword().filterable().retrievable(),
    breadth: search.integer().sortable().retrievable(false),
    terms: search.keyword().array().searchable().retrievable(),
    card: search.keyword().retrievable(),
  }),
  seed,
});
