import { isDeepStrictEqual } from 'node:util';
import type { MedusaContainer } from '@medusajs/framework/types';
import {
  CATEGORY_PAGE_SIZE,
  attributeValuesSchema,
  categoryPageCount,
  categoryFacets,
  partPageSlug,
  popularPicks,
  type CatalogLocale,
  type CategoryPageResponse,
} from '@podbor/catalog-contract';

import type PublishModuleService from '../modules/publish/service';
import type { ListedNumber } from '../modules/publish/service';
import { SUPPLIER_MODULE } from '../modules/supplier';
import type SupplierModuleService from '../modules/supplier/service';
import { memoized } from './catalogue-memo';
import { CATEGORY_RELATIONS, shownCategory } from './categories';
import { localizedCategory, localizedSeries } from './catalogue-locale';
import { memoPartDemand } from './part-demand';
import { sluggedPagesOf } from './part-pages';
import {
  type CatalogueModules,
  catalogueModules,
  seriesPagedInCategory,
} from './catalogue-structure';

const byName = new Intl.Collator('en', { numeric: true }).compare;

async function carsOf(
  modules: CatalogueModules,
  categoryId: string,
  locale: CatalogLocale,
): Promise<CategoryPageResponse['cars']> {
  const series = await memoized(`category-series:${categoryId}`, () =>
    seriesPagedInCategory(modules, categoryId),
  );
  const makes = new Map<
    string,
    { make: { slug: string; name: string }; series: typeof series }
  >();
  for (const entry of series) {
    const { slug, name } = entry.make;
    const known = makes.get(slug);
    if (known) known.series.push(entry);
    else makes.set(slug, { make: { slug, name }, series: [entry] });
  }
  return [...makes.values()]
    .sort((a, b) => byName(a.make.name, b.make.name))
    .map(({ make, series: own }) => ({
      make,
      series: own
        .sort((a, b) => byName(a.name, b.name))
        .map(({ slug, name, translations }) =>
          localizedSeries({ slug, name, translations }, locale),
        ),
    }));
}

export const categoryPartPages = <
  Number extends { brand_slug: string; normalized_value: string },
>(
  numbers: Number[],
): Number[] => {
  const seen = new Set<string>();
  return numbers.filter((number) => {
    const slug = partPageSlug(number.brand_slug, number.normalized_value);
    return !seen.has(slug) && seen.add(slug);
  });
};

export const listedNumbersByCategory = (publish: PublishModuleService) =>
  memoized('listed-numbers', async () => {
    const numbersOf = new Map<string, ListedNumber[]>();
    for (const number of await publish.listedNumbersIn(null)) {
      numbersOf.set(number.category_id, [
        ...(numbersOf.get(number.category_id) ?? []),
        number,
      ]);
    }
    return numbersOf;
  });

export async function categoryPageAt(
  scope: MedusaContainer,
  slug: string,
  {
    locale,
    shown,
    page,
  }: { locale: CatalogLocale; shown: boolean; page: number },
): Promise<CategoryPageResponse | null> {
  const modules = catalogueModules(scope);
  const { catalog, publish } = modules;
  const suppliers: SupplierModuleService = scope.resolve(SUPPLIER_MODULE);
  const [row] = await catalog.listCategories(
    { slug },
    { relations: CATEGORY_RELATIONS, take: 1 },
  );
  if (!row) return null;
  const category = shownCategory(row);

  const numbers = categoryPartPages(
    (await listedNumbersByCategory(publish)).get(category.id) ?? [],
  );
  const pages = categoryPageCount(numbers.length);
  if (page > pages) return null;

  const demand = await memoPartDemand(scope);
  const offers = shown
    ? await suppliers.storeOffersFor(numbers.map(({ id }) => id))
    : new Map();
  const items = numbers.map((number) => ({
    id: number.id,
    brand: { slug: number.brand_slug, name: number.brand_name },
    offers: offers.get(number.id) ?? [],
    attributes: attributeValuesSchema.parse(number.attributes),
    part: { id: number.part_id },
    demand: demand.get(number.id) ?? null,
  }));

  const ranges = category.fields.flatMap(({ key, type }) => {
    const values = items
      .flatMap(({ attributes }) => [attributes[key] ?? []].flat())
      .map(Number)
      .filter(Number.isFinite);
    return type === 'number' && values.length
      ? [{ key, min: Math.min(...values), max: Math.max(...values) }]
      : [];
  });
  const uniform = category.fields
    .filter(
      ({ key }) =>
        items.length > 1 &&
        items.every(({ attributes }) =>
          isDeepStrictEqual(attributes[key], items[0].attributes[key]),
        ),
    )
    .map(({ key }) => key);

  const listing = items
    .slice((page - 1) * CATEGORY_PAGE_SIZE, page * CATEGORY_PAGE_SIZE)
    .map(({ id }) => id);
  const popular = page === 1 ? popularPicks(items).map(({ id }) => id) : [];
  const shownIds = new Set([...listing, ...popular]);
  const entries = new Map(
    (
      await sluggedPagesOf(
        scope,
        [...shownIds].map((id) => ({ id, listed: true })),
        { locale, shown, demand },
      )
    ).map((entry) => [entry.id, entry]),
  );
  const entryOf = (id: string) => entries.get(id)!;

  return {
    category: localizedCategory(category, locale),
    page,
    pages,
    count: items.length,
    entries: listing.map(entryOf),
    popular: popular.map(entryOf),
    facets: categoryFacets(category.fields, items, locale),
    ranges,
    uniform,
    demanded: items.some(({ demand: own }) => (own?.score ?? 0) > 0),
    cars: await carsOf(modules, category.id, locale),
  };
}
