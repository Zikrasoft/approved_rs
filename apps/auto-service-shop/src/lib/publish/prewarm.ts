import { BRAND_LOCALES } from '@podbor/brands';
import type { CataloguePageList } from '@podbor/catalog-contract';

export const WARM_CONCURRENCY = 2;

export const WARM_TIMEOUT_MS = 30_000;

const CARS_PAGES_MAX = 20;

const SITEMAP_INDEX = '/sitemap-catalogue.xml';

export type WarmResult = { warmed: number; failed: number };

export type WarmOptions = {
  fetchPage?: typeof fetch;
  timeoutMs?: number;
};

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const carsLinks = (locale: string, html: string) => {
  const links = new RegExp(
    `href="(?:[^"]*?)/${escaped(locale)}/cars/([a-z0-9][a-z0-9-]*)/"`,
    'g',
  );
  const found = [...html.matchAll(links)].map(([, segment]) => segment);
  return {
    pages: found.filter((segment) => /^[2-9]\d*$/.test(segment)),
    makes: found.filter((segment) => !/^\d+$/.test(segment)),
  };
};

export const sitemapChunkPaths = (xml: string) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].flatMap(([, loc]) => {
    try {
      return [new URL(loc).pathname];
    } catch {
      return [];
    }
  });

export const cataloguePaths = (list: CataloguePageList) =>
  BRAND_LOCALES.flatMap((locale) => [
    `/${locale}/parts/`,
    `/${locale}/parts/makes/`,
    ...list.makes
      .filter(({ hub }) => hub)
      .map(({ slug }) => `/${locale}/parts/${slug}/`),
    ...list.categories.map(({ slug }) => `/${locale}/parts/c/${slug}/`),
    `/${locale}/llms.txt`,
  ]).concat('/llms.txt', '/catalogue-build.json');

type Task = { path: string; follow?: (body: string) => void };

export async function warmCataloguePages(
  origin: string,
  list: CataloguePageList,
  { fetchPage = fetch, timeoutMs = WARM_TIMEOUT_MS }: WarmOptions = {},
): Promise<WarmResult> {
  const result: WarmResult = { warmed: 0, failed: 0 };
  const queue: Task[] = [];
  const queued = new Set<string>();

  const enqueue = (task: Task) => {
    if (queued.has(task.path)) return;
    queued.add(task.path);
    queue.push(task);
  };

  const get = async (path: string) => {
    try {
      const response = await fetchPage(`${origin}${path}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(String(response.status));
      result.warmed += 1;
      return body;
    } catch {
      result.failed += 1;
      return null;
    }
  };

  const followCars = (locale: string, pagesLeft: number) => (html: string) => {
    const { pages, makes } = carsLinks(locale, html);
    for (const make of makes) enqueue({ path: `/${locale}/cars/${make}/` });
    if (pagesLeft > 0) {
      for (const page of pages) {
        enqueue({
          path: `/${locale}/cars/${page}/`,
          follow: followCars(locale, pagesLeft - 1),
        });
      }
    }
  };

  for (const locale of BRAND_LOCALES) {
    enqueue({
      path: `/${locale}/cars/`,
      follow: followCars(locale, CARS_PAGES_MAX),
    });
  }
  enqueue({
    path: SITEMAP_INDEX,
    follow: (xml) => {
      for (const path of sitemapChunkPaths(xml)) enqueue({ path });
    },
  });
  for (const path of cataloguePaths(list)) enqueue({ path });

  const work = async () => {
    for (let task = queue.shift(); task; task = queue.shift()) {
      const body = await get(task.path);
      if (body !== null) task.follow?.(body);
    }
  };
  await Promise.all(Array.from({ length: WARM_CONCURRENCY }, work));
  return result;
}
