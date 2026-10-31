import { defineSearchIndex, search } from '@medusajs/framework/utils';
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

type FitmentRow = { part_id: string; vehicle_id: string };

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
const modelOf = ({ model }: VehicleRow) => model.slug;

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

export function carsWithPages(
  vehicles: VehicleRow[],
  fitments: FitmentRow[],
  listedParts: Set<string>,
) {
  const partsOf = new Map<string, Set<string>>();
  for (const { part_id, vehicle_id } of fitments) {
    if (listedParts.has(part_id)) {
      partsOf.set(
        vehicle_id,
        (partsOf.get(vehicle_id) ?? new Set()).add(part_id),
      );
    }
  }
  const partsFitting = (rows: VehicleRow[]) =>
    new Set(rows.flatMap(({ id }) => [...(partsOf.get(id) ?? [])])).size;
  const models = groupBy(vehicles, modelOf).filter((rows) =>
    modelHasPage(partsFitting(rows)),
  );
  return {
    makes: groupBy(models.flat(), makeOf)
      .filter((rows) => makeHasPage(groupBy(rows, modelOf).length))
      .map(([row]) => row),
    models: models.map(([row]) => row),
    vehicles: models.flatMap((rows) => {
      const modelParts = partsFitting(rows);
      return rows.filter((row) =>
        vehicleHasPage({ parts: partsFitting([row]), modelParts }),
      );
    }),
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

export function carDocuments(
  vehicles: VehicleRow[],
  fitments: FitmentRow[],
  listed: Set<string>,
) {
  const paged = carsWithPages(vehicles, fitments, listed);
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
      document(modelKey(modelOf(row)), 'model', modelTerms(row), {
        make: make(row),
        model: modelCard(row.model),
        vehicle: null,
      }),
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

type NumberRow = { part_id: string; part: { replaced_by_id: string | null } };

const listedParts = async (
  query: SearchTypes.SearchContainer['query'],
): Promise<Set<string>> => {
  const { data: published } = await query.graph({
    entity: 'published_number',
    fields: ['id'],
  });
  const { data } = published.length
    ? await query.graph({
        entity: 'part_identifier',
        fields: ['part_id', 'part.replaced_by_id'],
        filters: { id: published.map(({ id }: { id: string }) => id) },
      })
    : { data: [] };
  const numbers = data as NumberRow[];
  const parts = new Set(numbers.map(({ part_id }) => part_id));
  return new Set(
    numbers
      .filter(
        ({ part }) => !part.replaced_by_id || !parts.has(part.replaced_by_id),
      )
      .map(({ part_id }) => part_id),
  );
};

async function* seed({ container, catchup }: SearchTypes.SearchSeedContext) {
  if (catchup) {
    return;
  }
  const [{ data: vehicles }, { data: fitments }, listed] = await Promise.all([
    container.query.graph({ entity: 'vehicle', fields: VEHICLE_FIELDS }),
    container.query.graph({
      entity: 'fitment',
      fields: ['part_id', 'vehicle_id'],
    }),
    listedParts(container.query),
  ]);
  const documents = carDocuments(
    vehicles as VehicleRow[],
    fitments as FitmentRow[],
    listed,
  );
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
