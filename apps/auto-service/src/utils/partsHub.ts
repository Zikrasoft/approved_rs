import { translated } from '@podbor/catalog-contract';
import { paragraphs } from '@podbor/site-kit';
import { localeConfig, type Locale } from '../i18n/config.ts';
import {
  type CatalogueEnv,
  categoryPagesForBuild,
  makeHubsForBuild,
} from './catalogueEnv.ts';
import type { CategoryPageEntry, MakeHubEntry } from './catalogueSnapshot.ts';
import { byDemand, demandOf } from './demand.ts';
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
  categories: CategoryPageEntry[],
  makes: MakeHubEntry[],
): PartsHub => ({
  makes: topMakes(makes, TOP_MAKES).map(({ make }) => ({
    slug: make.slug,
    name: make.name,
  })),
  categories: byDemand(categories, ({ pages }) => demandOf(pages)).map(
    (category) => ({
      slug: category.slug,
      empty: category.pages.length === 0,
      name: perLocale((locale) => translated(category, 'name', locale)),
      lead: perLocale(
        (locale) => paragraphs(translated(category, 'text', locale))[0] ?? null,
      ),
    }),
  ),
});

export function partsHubPlugin(env: CatalogueEnv) {
  const resolved = `\0${PARTS_HUB_MODULE}`;
  return {
    name: 'carlab-parts-hub',
    resolveId: (id: string) => (id === PARTS_HUB_MODULE ? resolved : null),
    async load(id: string) {
      if (id !== resolved) return null;
      const [categories, makes] = await Promise.all([
        categoryPagesForBuild(env),
        makeHubsForBuild(env),
      ]);
      return `export default ${JSON.stringify(partsHubOf(categories, makes))};`;
    },
  };
}
