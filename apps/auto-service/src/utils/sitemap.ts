import {
  categoryPageCount,
  seriesCategoryPageCount,
  type CataloguePageList,
} from '@podbor/catalog-contract';
import { CARLAB } from '@podbor/brands';
import type { Catalogue } from './cataloguePage';
import { SUPPORTED_LOCALES } from '../i18n/config.ts';
import { CARS_PAGE_SIZE } from './works';
import { makeHubPageCount } from './makeHub';
import { PathBuilder } from './paths';

export const CATALOGUE_SITEMAP_SIZE = 45_000;

export function sitemapFilter(
  site: string,
  blogListed = true,
): (page: string) => boolean {
  const excluded = [
    '/thanks/',
    '/parts/cart/',
    '/admin/',
    ...(blogListed ? [] : ['/blog/']),
  ];
  return (page) =>
    page !== `${site}/` && !excluded.some((part) => page.includes(part));
}

export function catalogueUrls(
  site: string,
  { parts, makes, series, categories }: CataloguePageList,
): string[] {
  const hubs = makes.filter(({ hub }) => hub);
  return SUPPORTED_LOCALES.flatMap((locale) =>
    [
      PathBuilder.parts(locale),
      PathBuilder.partsMakes(locale),
      ...hubs.flatMap(({ slug }) =>
        Array.from(
          {
            length: makeHubPageCount(
              series.filter(({ make }) => make === slug).length,
            ),
          },
          (_, index) => PathBuilder.partsMake(locale, slug, index + 1),
        ),
      ),
      ...series.flatMap((entry) => [
        PathBuilder.partsSeries(locale, entry.make, entry.slug),
        ...entry.categories.flatMap((category) =>
          Array.from(
            { length: seriesCategoryPageCount(entry.listed?.[category] ?? 0) },
            (_, index) =>
              PathBuilder.partsSeriesCategory(
                locale,
                entry.make,
                entry.slug,
                category,
                index + 1,
              ),
          ),
        ),
      ]),
      ...categories.flatMap(({ slug, listed }) =>
        Array.from({ length: categoryPageCount(listed ?? 0) }, (_, index) =>
          PathBuilder.partsCategory(locale, slug, index + 1),
        ),
      ),
      ...parts
        .filter(({ indexable }) => indexable)
        .map(({ slug }) => PathBuilder.partNumber(locale, slug)),
    ].map((path) => `${site}${path}`),
  );
}

export function carsUrls(site: string, makes: string[]): string[] {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    [
      ...Array.from(
        { length: Math.max(1, Math.ceil(makes.length / CARS_PAGE_SIZE)) },
        (_, index) => PathBuilder.cars(locale, index + 1),
      ),
      ...makes.map((slug) => PathBuilder.carsMake(locale, slug)),
    ].map((path) => `${site}${path}`),
  );
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>';
const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';

const catalogueSitemapChunks = (urls: string[]): string[][] =>
  Array.from(
    { length: Math.ceil(urls.length / CATALOGUE_SITEMAP_SIZE) },
    (_, index) =>
      urls.slice(
        index * CATALOGUE_SITEMAP_SIZE,
        (index + 1) * CATALOGUE_SITEMAP_SIZE,
      ),
  );

export const catalogueSitemapPath = (chunk: number) =>
  `/sitemap-catalogue-${chunk}.xml`;

export const sitemapIndexXml = (sitemaps: string[]): string =>
  `${XML_HEAD}<sitemapindex xmlns="${SITEMAP_NAMESPACE}">${sitemaps
    .map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`)
    .join('')}</sitemapindex>`;

export const urlsetXml = (urls: string[]): string =>
  `${XML_HEAD}<urlset xmlns="${SITEMAP_NAMESPACE}">${urls
    .map((loc) => `<url><loc>${loc}</loc></url>`)
    .join('')}</urlset>`;

export const catalogueSitemaps = async (catalogue: Catalogue) =>
  catalogueSitemapChunks(catalogueUrls(CARLAB.url, await catalogue.pageList()));
