import type { MedusaContainer } from '@medusajs/framework/types';
import {
  translated,
  type CatalogLocale,
  type MakePageResponse,
  type MakesPageResponse,
} from '@podbor/catalog-contract';

import { catalogueModules, catalogueStructure } from './catalogue-structure';

export async function makesPage(
  scope: MedusaContainer,
): Promise<MakesPageResponse> {
  const { paged } = await catalogueStructure(catalogueModules(scope));
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
  const structure = await catalogueStructure(modules, { make_id: make.id });
  if (!structure.hub(make.slug)) return null;
  const { paged } = structure;
  const categoryIds = [
    ...new Set(paged.flatMap(({ categoryIds: own }) => own)),
  ];
  const categories = categoryIds.length
    ? await catalog.listCategories(
        { id: categoryIds },
        { order: { slug: 'ASC' }, take: null },
      )
    : [];
  const categoriesOf = (own: string[]) =>
    categories
      .filter(({ id }) => own.includes(id))
      .map((category) => translated(category, 'name', locale));
  return {
    make: { slug: make.slug, name: make.name },
    series: paged.map((entry) => ({
      slug: entry.slug,
      name: translated(entry, 'name', locale),
      category_names: categoriesOf(entry.categoryIds),
    })),
  };
}
