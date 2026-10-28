import { defineSearchIndex, search } from '@medusajs/framework/utils';
import type {
  ISearchModuleService,
  SearchTypes,
} from '@medusajs/framework/types';
import {
  type CarHit,
  type CarKind,
  carHitSchema,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { serbianScripts } from '../lib/serbian';

export const CATALOGUE_CAR_INDEX = 'catalogue_car';

const MIN_PARTS_FOR_PAGE = 3;
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

export type CarAddress = {
  id: string;
  model: { slug: string; chassis: { series: { make: { slug: string } } } };
};

export const searchTokens = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const termsOf = (...texts: (string | null | undefined)[]): string[] =>
  texts.flatMap((text) => {
    if (!text) return [];
    const { latin, cyrillic } = serbianScripts(text);
    return [text, latin, cyrillic].flatMap(searchTokens);
  });

const makeKey = (slug: string) => `make:${slug}`;
const modelKey = (slug: string) => `model:${slug}`;
const vehicleKey = (id: string) => `vehicle:${id}`;

export const fittedCarKeys = ({ id, model }: CarAddress): string[] => [
  makeKey(model.chassis.series.make.slug),
  modelKey(model.slug),
  vehicleKey(id),
];

const makeOf = ({ model }: VehicleRow) => model.chassis.series.make.slug;
const modelOf = ({ model }: VehicleRow) => model.slug;

const unionBy = (
  vehicles: VehicleRow[],
  key: (vehicle: VehicleRow) => string,
  members: (vehicle: VehicleRow) => Iterable<string>,
) => {
  const byKey = new Map<string, Set<string>>();
  for (const vehicle of vehicles) {
    const set = byKey.get(key(vehicle)) ?? new Set<string>();
    for (const member of members(vehicle)) set.add(member);
    byKey.set(key(vehicle), set);
  }
  return byKey;
};

const firstBy = (
  vehicles: VehicleRow[],
  key: (vehicle: VehicleRow) => string,
) => [...new Map(vehicles.map((vehicle) => [key(vehicle), vehicle])).values()];

// TODO: switch to the shared page-existence predicates (MIN_PARTS_FOR_PAGE) in @podbor/catalog-contract once feat/fewer-catalogue-pages lands.
export function carsWithPages(
  vehicles: VehicleRow[],
  fitments: FitmentRow[],
  publishedParts: Set<string>,
) {
  const partsOf = new Map<string, Set<string>>();
  for (const { part_id, vehicle_id } of fitments) {
    if (publishedParts.has(part_id)) {
      partsOf.set(
        vehicle_id,
        (partsOf.get(vehicle_id) ?? new Set()).add(part_id),
      );
    }
  }
  const fitted = (vehicle: VehicleRow) => partsOf.get(vehicle.id) ?? [];
  const byMake = unionBy(vehicles, makeOf, fitted);
  const byModel = unionBy(vehicles, modelOf, fitted);
  const modelVehicles = unionBy(vehicles, modelOf, ({ id }) => [id]);
  const enough = (parts: Set<string> | undefined) =>
    (parts?.size ?? 0) >= MIN_PARTS_FOR_PAGE;
  return {
    makes: firstBy(vehicles, makeOf).filter((row) =>
      enough(byMake.get(makeOf(row))),
    ),
    models: firstBy(vehicles, modelOf).filter((row) =>
      enough(byModel.get(modelOf(row))),
    ),
    vehicles: vehicles.filter(
      (row) =>
        enough(partsOf.get(row.id)) &&
        (modelVehicles.get(modelOf(row))?.size ?? 0) > 1,
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

export function carDocuments(
  vehicles: VehicleRow[],
  fitments: FitmentRow[],
  publishedParts: Set<string>,
) {
  const paged = carsWithPages(vehicles, fitments, publishedParts);
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

async function* seed({ container, catchup }: SearchTypes.SearchSeedContext) {
  if (catchup) {
    return;
  }
  const [{ data: vehicles }, { data: fitments }, { data: published }] =
    await Promise.all([
      container.query.graph({ entity: 'vehicle', fields: VEHICLE_FIELDS }),
      container.query.graph({
        entity: 'fitment',
        fields: ['part_id', 'vehicle_id'],
      }),
      container.query.graph({ entity: 'published_number', fields: ['id'] }),
    ]);
  const { data: numbers } = published.length
    ? await container.query.graph({
        entity: 'part_identifier',
        fields: ['part_id'],
        filters: { id: published.map(({ id }: { id: string }) => id) },
      })
    : { data: [] };
  const documents = carDocuments(
    vehicles as VehicleRow[],
    fitments as FitmentRow[],
    new Set(numbers.map(({ part_id }: { part_id: string }) => part_id)),
  );
  if (documents.length) {
    yield [{ action: 'upsert' as const, documents }];
  }
}

const hitSchema = z.object({
  id: z.string(),
  terms: z.array(z.string()),
  card: z.string().transform((card) => carHitSchema.parse(JSON.parse(card))),
});

export type CarMatch = { cars: CarHit[]; keys: string[]; rest: string[] };

export async function matchCars(
  searchModule: ISearchModuleService,
  q: string,
): Promise<CarMatch> {
  const tokens = searchTokens(q).slice(0, MAX_QUERY_TOKENS);
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
      .map(({ document: found }) => hitSchema.parse(found))
      .map((hit) => [hit.id, hit]),
  );
  const covers = (terms: string[], token: string, index: number) =>
    terms.includes(token) ||
    (index === last &&
      token.length >= 2 &&
      terms.some((term) => term.startsWith(token)));
  const scored = [...hits.values()].map((hit) => ({
    ...hit,
    covered: tokens.filter((token, index) => covers(hit.terms, token, index)),
  }));
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
    rest: tokens.filter((token) => !covered.has(token)),
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
