import type { MedusaContainer } from '@medusajs/framework/types';
import {
  makeHasPage,
  seriesCategoryHasPage,
  translated,
  type CatalogLocale,
  type MakePageResponse,
  type MakesPageResponse,
} from '@podbor/catalog-contract';
import { seriesSlugOf } from '@podbor/catalog-contract/slug';

import { catalogueModules, seriesWithPages } from './series-pages';

export async function makesPage(
  scope: MedusaContainer,
): Promise<MakesPageResponse> {
  const { paged } = await seriesWithPages(catalogueModules(scope), {});
  const makes = new Map(
    paged.map(({ make }) => [make.slug, { slug: make.slug, name: make.name }]),
  );
  return {
    makes: [...makes.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

export async function makePageAt(
  scope: MedusaContainer,
  slug: string,
  { locale }: { locale: CatalogLocale },
): Promise<MakePageResponse | null> {
  const modules = catalogueModules(scope);
  const { catalog } = modules;
  const [make] = await catalog.listMakes({ slug }, { take: 1 });
  if (!make) return null;
  const { paged, held } = await seriesWithPages(modules, { make_id: make.id });
  if (!makeHasPage(paged.length)) return null;
  const categoryIds = [
    ...new Set(held.flatMap(({ category_id }) => category_id ?? [])),
  ];
  const categories = categoryIds.length
    ? await catalog.listCategories(
        { id: categoryIds },
        { order: { slug: 'ASC' }, take: null },
      )
    : [];
  const categoriesOf = (seriesId: string) =>
    categories
      .filter(({ id }) =>
        held.some(
          (row) =>
            row.series_id === seriesId &&
            row.category_id === id &&
            seriesCategoryHasPage(row.parts),
        ),
      )
      .map((category) => translated(category, 'name', locale));
  return {
    make: { slug: make.slug, name: make.name },
    series: paged.map((entry) => ({
      slug: seriesSlugOf(entry.name),
      name: translated(entry, 'name', locale),
      categories: categoriesOf(entry.id),
    })),
  };
}
