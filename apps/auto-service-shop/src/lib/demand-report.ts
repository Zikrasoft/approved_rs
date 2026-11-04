import type { MedusaContainer } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../modules/catalog';
import type CatalogModuleService from '../modules/catalog/service';
import { type DemandCounts, demandScore } from '../modules/demand/ranking';
import { daysBack, demandModule } from './part-demand';

const SHOWN = { parts: 50, categories: 20, cars: 20, queries: 30 };

type Tally = DemandCounts & { score: number };

const NO_DEMAND: Tally = { orders: 0, inquiries: 0, picks: 0, score: 0 };

const added = (a: Tally, b: Tally): Tally => ({
  orders: a.orders + b.orders,
  inquiries: a.inquiries + b.inquiries,
  picks: a.picks + b.picks,
  score: a.score + b.score,
});

const mostDemanded = <T extends { score: number }>(rows: T[], shown: number) =>
  rows.sort((a, b) => b.score - a.score).slice(0, shown);

type Totals<T> = Map<string, { of: T; tally: Tally }>;

const tallied = <T>(totals: Totals<T>, key: string, of: T, tally: Tally) =>
  totals.set(key, {
    of,
    tally: added(totals.get(key)?.tally ?? NO_DEMAND, tally),
  });

export async function demandReport(
  scope: MedusaContainer,
  days: number,
  now: Date = new Date(),
) {
  const since = daysBack(now, days);
  const demand = demandModule(scope);
  const catalog = scope.resolve<CatalogModuleService>(CATALOG_MODULE);
  const counts = await demand.countsSince(since);
  const identifiers = await catalog.listPartIdentifiers(
    { id: counts.map(({ id }) => id) },
    { relations: ['brand', 'part', 'part.category'], take: null },
  );
  const byId = new Map(
    identifiers.map((identifier) => [identifier.id, identifier]),
  );
  const parts = counts.flatMap(({ id, orders, inquiries, picks }) => {
    const identifier = byId.get(id);
    if (!identifier) return [];
    const tally = {
      orders,
      inquiries,
      picks,
      score: demandScore({ orders, inquiries, picks }),
    };
    return [{ identifier, tally }];
  });

  const categories: Totals<string> = new Map();
  const partTotals = new Map<string, Tally>();
  for (const { identifier, tally } of parts) {
    const { category } = identifier.part;
    if (category) tallied(categories, category.id, category.name, tally);
    partTotals.set(
      identifier.part_id,
      added(partTotals.get(identifier.part_id) ?? NO_DEMAND, tally),
    );
  }

  const fitments = await catalog.listFitments(
    { part_id: [...partTotals.keys()] },
    {
      relations: [
        'vehicle',
        'vehicle.model',
        'vehicle.model.make',
        'vehicle.model.chassis',
        'vehicle.model.chassis.series',
      ],
      take: null,
    },
  );
  const fittedModels = new Map<
    string,
    { model: (typeof fitments)[number]['vehicle']['model']; parts: Set<string> }
  >();
  for (const { part_id, vehicle } of fitments) {
    const entry = fittedModels.get(vehicle.model.id) ?? {
      model: vehicle.model,
      parts: new Set<string>(),
    };
    entry.parts.add(part_id);
    fittedModels.set(vehicle.model.id, entry);
  }

  return {
    days,
    parts: mostDemanded(
      parts.map(({ identifier, tally }) => ({
        id: identifier.id,
        brand: identifier.brand.name,
        number: identifier.value,
        name: identifier.part.name,
        category: identifier.part.category?.name ?? null,
        ...tally,
      })),
      SHOWN.parts,
    ),
    categories: mostDemanded(
      [...categories.values()].map(({ of, tally }) => ({ name: of, ...tally })),
      SHOWN.categories,
    ),
    cars: mostDemanded(
      [...fittedModels.values()].map(({ model, parts: fitted }) => ({
        make: model.make.name,
        series: model.chassis.series.name,
        model: model.name,
        score: [...fitted].reduce(
          (sum, partId) => sum + (partTotals.get(partId)?.score ?? 0),
          0,
        ),
      })),
      SHOWN.cars,
    ),
    missed_queries: await demand.missedQueriesSince(since, SHOWN.queries),
  };
}
