import {
  translated,
  type CataloguePageList,
  type Category,
} from '@podbor/catalog-contract';
import { paragraphs } from '@podbor/site-kit';
import { localeConfig, type Locale } from '../i18n/config.ts';
import {
  type CatalogueEnv,
  categoriesForBuild,
  pageListForBuild,
} from './catalogueEnv.ts';
import { byDemand } from './demand.ts';
import { TOP_MAKES, topMakes } from './makeIndex.ts';

export type PartsHub = {
  makes: { slug: string; name: string }[];
  categories: {
    slug: string;
    empty: boolean;
    name: Record<Locale, string>;
    lead: Record<Locale, string | null>;
  }[];
};

export const PARTS_HUB_MODULE = 'virtual:parts-hub';

const perLocale = <T>(read: (locale: Locale) => T) =>
  Object.fromEntries(
    localeConfig.locales.map((locale) => [locale, read(locale)]),
  ) as Record<Locale, T>;

export const partsHubOf = (
  categories: Category[],
  list: CataloguePageList,
): PartsHub => {
  const listed = new Map(list.categories.map((own) => [own.slug, own.listed]));
  const count = ({ slug }: Category) => listed.get(slug) ?? 0;
  const hubs = list.makes
    .filter(({ hub }) => hub)
    .map(({ slug, name, parts }) => ({
      make: { slug, name },
      parts: parts ?? 0,
    }));
  return {
    makes: topMakes(hubs, TOP_MAKES).map(({ make }) => make),
    categories: byDemand(categories, count).map((category) => ({
      slug: category.slug,
      empty: listed.get(category.slug) === 0,
      name: perLocale((locale) => translated(category, 'name', locale)),
      lead: perLocale(
        (locale) => paragraphs(translated(category, 'text', locale))[0] ?? null,
      ),
    })),
  };
};

export function partsHubPlugin(env: CatalogueEnv) {
  const resolved = `\0${PARTS_HUB_MODULE}`;
  return {
    name: 'carlab-parts-hub',
    resolveId: (id: string) => (id === PARTS_HUB_MODULE ? resolved : null),
    async load(id: string) {
      if (id !== resolved) return null;
      const [categories, list] = await Promise.all([
        categoriesForBuild(env),
        pageListForBuild(env),
      ]);
      return `export default ${JSON.stringify(partsHubOf(categories, list))};`;
    },
  };
}
