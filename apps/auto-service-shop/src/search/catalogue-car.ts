import { container } from '@medusajs/framework';
import type { Knex } from '@medusajs/framework/mikro-orm/knex';
import {
  ContainerRegistrationKeys,
  defineSearchIndex,
  search,
} from '@medusajs/framework/utils';
import type {
  ISearchModuleService,
  SearchTypes,
} from '@medusajs/framework/types';
import {
  type CarHit,
  type CarKind,
  makeHasPage,
  modelHasPage,
  vehicleHasPage,
} from '@podbor/catalog-contract';

import {
  CATALOGUE_CAR_INDEX,
  makeKey,
  modelKey,
  readCarHit,
  vehicleKey,
} from '../lib/car-pages';
import { serbianScripts } from '../lib/serbian';

const MAX_QUERY_TOKENS = 8;
const HITS_PER_TOKEN = 100;
const CARS_SHOWN = 8;
const BREADTH: Record<CarKind, number> = { make: 2, model: 1, vehicle: 0 };

type MakeRow = { slug: string; name: string; spellings: { value: string }[] };

type ModelRow = {
  id: string;
  slug: string;
  name: string;
  chassis: {
    code: string;
    body_style: string | null;
    series: {
      name: string;
      translations: { sr?: string; en?: string } | null;
      make: MakeRow;
    };
  };
};

type VehicleRow = {
  id: string;
  slug: string | null;
  power_kw: number | null;
  year_from: number | null;
  year_to: number | null;
  engine: { code: string; family: string };
  model: ModelRow;
};

export type PartCounts = {
  vehicles: Map<string, number>;
  models: Map<string, number>;
};

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
const modelOf = ({ model }: VehicleRow) => model.id;

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
  const modelParts = ([row]: VehicleRow[]) =>
    counts.models.get(modelOf(row)) ?? 0;
  const models = groupBy(vehicles, modelOf).filter((rows) =>
    modelHasPage(modelParts(rows)),
  );
  return {
    makes: groupBy(models.flat(), makeOf)
      .filter((rows) => makeHasPage(groupBy(rows, modelOf).length))
      .map(([row]) => row),
    models: models.map(([row]) => row),
    vehicles: models.flatMap((rows) =>
      rows.filter((row) =>
        vehicleHasPage({
          parts: counts.vehicles.get(row.id) ?? 0,
          modelParts: modelParts(rows),
        }),
      ),
    ),
  };
}

const makeCard = ({ slug, name }: MakeRow) => ({ slug, name });

const modelCard = ({ slug, name, chassis }: ModelRow) => ({
  slug,
  name,
  chassis: {
    code: chassis.code,
    body_style: chassis.body_style,
    series: {
      name: chassis.series.name,
      translations: chassis.series.translations,
      make: makeCard(chassis.series.make),
    },
  },
});

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
  const modelTerms = (row: VehicleRow) => {
    const { series, code } = row.model.chassis;
    return [
      ...makeTerms(row),
      ...termsOf(
        series.name,
        series.translations?.sr,
        series.translations?.en,
        code,
        row.model.name,
      ),
    ];
  };
  const make = (row: VehicleRow) => makeCard(row.model.chassis.series.make);
  return [
    ...paged.makes.map((row) =>
      document(makeKey(makeOf(row)), 'make', makeTerms(row), {
        make: make(row),
        model: null,
        vehicle: null,
      }),
    ),
    ...paged.models.map((row) =>
      document(
        modelKey(makeOf(row), row.model.slug),
        'model',
        modelTerms(row),
        {
          make: make(row),
          model: modelCard(row.model),
          vehicle: null,
        },
      ),
    ),
    ...paged.vehicles.map((row) =>
      document(
        vehicleKey(row.id),
        'vehicle',
        [...modelTerms(row), ...termsOf(row.engine.code, row.engine.family)],
        {
          make: make(row),
          model: modelCard(row.model),
          vehicle: {
            id: row.id,
            slug: row.slug,
            engine: { code: row.engine.code },
            power_kw: row.power_kw,
            year_from: row.year_from,
            year_to: row.year_to,
          },
        },
      ),
    ),
  ];
}

const VEHICLE_FIELDS = [
  'id',
  'slug',
  'power_kw',
  'year_from',
  'year_to',
  'engine.code',
  'engine.family',
  'model.id',
  'model.slug',
  'model.name',
  'model.chassis.code',
  'model.chassis.body_style',
  'model.chassis.series.name',
  'model.chassis.series.translations',
  'model.chassis.series.make.slug',
  'model.chassis.series.make.name',
  'model.chassis.series.make.spellings.value',
];

const LISTED_PART_COUNTS = `
  with published_parts as (
    select distinct pi.part_id from part_identifier pi
    join published_number pn on pn.id = pi.id and pn.deleted_at is null
    where pi.deleted_at is null
  ), listed as (
    select p.id from part p
    join published_parts pp on pp.part_id = p.id
    where p.deleted_at is null and (
      p.replaced_by_id is null
      or p.replaced_by_id not in (select part_id from published_parts)
    )
  )
  select v.model_id, f.vehicle_id, count(distinct f.part_id)::int as parts
  from fitment f
  join listed l on l.id = f.part_id
  join vehicle v on v.id = f.vehicle_id and v.deleted_at is null
  where f.deleted_at is null
  group by grouping sets ((v.model_id, f.vehicle_id), (v.model_id))`;

type CountRow = { model_id: string; vehicle_id: string | null; parts: number };

export async function listedPartCounts(pg: Knex): Promise<PartCounts> {
  const { rows } = await pg.raw<{ rows: CountRow[] }>(LISTED_PART_COUNTS);
  const counts: PartCounts = { vehicles: new Map(), models: new Map() };
  for (const { model_id, vehicle_id, parts } of rows) {
    if (vehicle_id) counts.vehicles.set(vehicle_id, parts);
    else counts.models.set(model_id, parts);
  }
  return counts;
}

async function* seed({
  container: { query },
  catchup,
}: SearchTypes.SearchSeedContext) {
  if (catchup) {
    return;
  }
  const [{ data: vehicles }, counts] = await Promise.all([
    query.graph({ entity: 'vehicle', fields: VEHICLE_FIELDS }),
    listedPartCounts(
      container.resolve(ContainerRegistrationKeys.PG_CONNECTION),
    ),
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
