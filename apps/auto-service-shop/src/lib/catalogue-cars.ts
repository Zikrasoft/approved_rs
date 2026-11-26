import type { MedusaContainer } from '@medusajs/framework/types';
import {
  MAKE_SHOWCASE,
  MAKE_TOP_CATEGORIES,
  offerRank,
  showcaseOf,
  type PartOffer,
  type CarMakePageResponse,
  type CatalogLocale,
} from '@podbor/catalog-contract';

import type { CategoryPart } from '../modules/publish/service';
import { SUPPLIER_MODULE } from '../modules/supplier';
import type SupplierModuleService from '../modules/supplier/service';
import { CATEGORY_RELATIONS, shownCategory } from './categories';
import { localizedCategory } from './catalogue-locale';
import { publishedOfParts, sluggedPagesOf } from './part-pages';
import { catalogueModules, catalogueStructure } from './catalogue-structure';

export async function carMakePageAt(
  scope: MedusaContainer,
  slug: string,
  options: { locale: CatalogLocale; shown: boolean },
): Promise<CarMakePageResponse | null> {
  const modules = catalogueModules(scope);
  const { catalog, publish } = modules;
  const [make] = await catalog.listMakes({ slug }, { take: 1 });
  if (!make) return null;
  const structure = await catalogueStructure(modules, { make_id: make.id });
  const { series } = structure;
  const places = series.length
    ? await publish.listedCategoryParts(series.map(({ id }) => id))
    : [];
  const byCategory = new Map<string, CategoryPart[]>();
  for (const place of places) {
    byCategory.set(place.category_id, [
      ...(byCategory.get(place.category_id) ?? []),
      place,
    ]);
  }
  if (byCategory.size === 0) return null;
  const categories = await catalog.listCategories(
    { id: [...byCategory.keys()] },
    { relations: CATEGORY_RELATIONS, order: { slug: 'ASC' }, take: null },
  );
  const partsIn = (id: string) => byCategory.get(id)!;
  const top = [...categories]
    .sort((a, b) => partsIn(b.id).length - partsIn(a.id).length)
    .slice(0, MAKE_TOP_CATEGORIES);
  const published = await publishedOfParts(
    scope,
    top.flatMap(({ id }) => partsIn(id).map(({ part_id }) => part_id)),
  );
  const offers = options.shown
    ? await scope
        .resolve<SupplierModuleService>(SUPPLIER_MODULE)
        .storeOffersFor(published.map(({ id }) => id))
    : new Map<string, PartOffer[]>();
  const numbersOf = new Map<string, string[]>();
  for (const { id, part_id } of published) {
    numbersOf.set(part_id, [...(numbersOf.get(part_id) ?? []), id]);
  }
  const rankOf = (partId: string) =>
    offerRank(numbersOf.get(partId)!.flatMap((id) => offers.get(id) ?? []));
  const contenders = top.map((category) =>
    partsIn(category.id)
      .map(({ part_id }) => part_id)
      .filter((id) => numbersOf.has(id))
      .map((id) => ({ id, rank: rankOf(id) }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, MAKE_SHOWCASE)
      .map(({ id }) => id),
  );
  const shownParts = new Set(contenders.flat());
  const pages = await sluggedPagesOf(
    scope,
    published.filter(({ part_id }) => shownParts.has(part_id)),
    options,
  );
  const queues = top.map((category, column) => {
    const shownOne = localizedCategory(shownCategory(category), options.locale);
    return partsIn(category.id)
      .filter(({ part_id }) => contenders[column].includes(part_id))
      .map(({ part_id }) =>
        pages
          .filter(({ part }) => part.id === part_id)
          .map((page) => ({ ...page, category: shownOne })),
      )
      .filter((own) => own.length > 0);
  });
  return {
    hub: structure.hub(make.slug),
    categories: top.map((category) =>
      localizedCategory(shownCategory(category), options.locale),
    ),
    showcase: showcaseOf(queues),
  };
}
