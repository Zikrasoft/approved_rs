import {
  translated,
  type CataloguePageList,
  type Category,
} from '@podbor/catalog-contract';
import { paragraphs } from '@podbor/site-kit';
import { localeConfig, type Locale } from '../i18n/config.ts';
import type { Catalogue } from './cataloguePage.ts';
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

const perLocale = <T>(read: (locale: Locale) => T) =>
  Object.fromEntries(
    localeConfig.locales.map((locale) => [locale, read(locale)]),
  ) as Record<Locale, T>;

export const partsHubOf = (
  categories: Category[],
  list: CataloguePageList,
): PartsHub => {
  const own = new Map(list.categories.map((entry) => [entry.slug, entry]));
  const demand = ({ slug }: Category) => own.get(slug)?.demand ?? 0;
  const hubs = list.makes
    .filter(({ hub }) => hub)
    .map(({ slug, name, parts }) => ({
      make: { slug, name },
      parts: parts ?? 0,
    }));
  return {
    makes: topMakes(hubs, TOP_MAKES).map(({ make }) => make),
    categories: byDemand(categories, demand).map((category) => ({
      slug: category.slug,
      empty: own.get(category.slug)?.listed === 0,
      name: perLocale((locale) => translated(category, 'name', locale)),
      lead: perLocale(
        (locale) => paragraphs(translated(category, 'text', locale))[0] ?? null,
      ),
    })),
  };
};

export const EMPTY_PARTS_HUB: PartsHub = { makes: [], categories: [] };

export const partsHubFrom = async (catalogue: Catalogue): Promise<PartsHub> =>
  partsHubOf(
    ...(await Promise.all([catalogue.categories(), catalogue.pageList()])),
  );
