import { readFile, writeFile } from 'node:fs/promises';
import type { AstroIntegration } from 'astro';
import { z } from 'zod';
import type {
  CataloguePlace,
  CatalogueRedirect,
} from '@podbor/catalog-contract';
import { SUPPORTED_LOCALES, type Locale } from '../i18n/config.ts';
import { PathBuilder, placeKey, type CataloguePages } from './paths.ts';

export type RedirectRoute = {
  src: string;
  headers: { Location: string };
  status: 301;
};

const vercelConfigSchema = z
  .object({ routes: z.array(z.unknown()).optional() })
  .loose();

type VercelConfig = z.infer<typeof vercelConfigSchema>;

const PART_NUMBER = '\u0001';

const pattern = (path: string) =>
  path
    .slice(0, -1)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll(PART_NUMBER, '([a-z0-9]+)');

const exactly = (path: string) => `^${pattern(path)}/?$`;

const under = (path: string) => `^${pattern(path)}(?=/|$)/?(.*)$`;

const route = (src: string, location: string): RedirectRoute => ({
  src,
  headers: { Location: location },
  status: 301,
});

const pathOf = (locale: Locale, to: CataloguePlace) => {
  if (to.part) return PathBuilder.partNumber(locale, to.part);
  if (to.make) return PathBuilder.partsMake(locale, to.make);
  if (to.category) return PathBuilder.partsCategory(locale, to.category);
  return PathBuilder.parts(locale);
};

const withPage = (
  pages: CataloguePages,
  place: CataloguePlace,
): CataloguePlace =>
  place.part || !place.make || pages.makes.has(place.make)
    ? place
    : { ...place, make: null };

function localeRoutes(
  locale: Locale,
  { from, to: wanted }: CatalogueRedirect,
  pages: CataloguePages,
): RedirectRoute[] {
  const to = withPage(pages, wanted);
  const target = pathOf(locale, to);
  if (from.part) {
    return [route(exactly(PathBuilder.partNumber(locale, from.part)), target)];
  }
  if (from.model || from.vehicle) {
    return [];
  }
  if (from.make) {
    const old = PathBuilder.partsMake(locale, from.make);
    return [route(under(old), to.make ? `${target}$1` : target)];
  }
  if (from.category) {
    const listing = PathBuilder.partsCategory(locale, from.category);
    const renamed = from.category;
    const next = to.category;
    return [
      route(under(listing), next ? `${target}$1` : target),
      ...[...pages.series].map((key) => {
        const [make, series] = key.split('/');
        return route(
          exactly(
            PathBuilder.partsSeriesCategory(locale, make, series, renamed),
          ),
          next && pages.categories.has(placeKey(key, next))
            ? PathBuilder.partsSeriesCategory(locale, make, series, next)
            : PathBuilder.partsSeries(locale, make, series),
        );
      }),
    ];
  }
  if (from.brand && to.brand) {
    return [
      route(
        exactly(PathBuilder.partNumber(locale, `${from.brand}-${PART_NUMBER}`)),
        PathBuilder.partNumber(locale, `${to.brand}-$1`),
      ),
    ];
  }
  return [];
}

export const catalogueRoutes = (
  redirects: CatalogueRedirect[],
  pages: CataloguePages,
): RedirectRoute[] =>
  redirects.flatMap((redirect) =>
    SUPPORTED_LOCALES.flatMap((locale) =>
      localeRoutes(locale, redirect, pages),
    ),
  );

export function withCatalogueRoutes<Config extends VercelConfig>(
  config: Config,
  routes: RedirectRoute[],
): Config {
  const all = config.routes ?? [];
  const notFound = all.findIndex(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      'status' in entry &&
      entry.status === 404,
  );
  const at = notFound === -1 ? all.length : notFound;
  return {
    ...config,
    routes: [...all.slice(0, at), ...routes, ...all.slice(at)],
  };
}

export function catalogueRedirectsIntegration(
  routes: RedirectRoute[],
): AstroIntegration {
  let root: URL;
  return {
    name: 'catalogue-redirects',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = config.root;
      },
      'astro:build:done': async () => {
        if (!routes.length) return;
        const file = new URL('.vercel/output/config.json', root);
        const config = vercelConfigSchema.parse(
          JSON.parse(await readFile(file, 'utf8')),
        );
        await writeFile(
          file,
          JSON.stringify(withCatalogueRoutes(config, routes), null, 2),
        );
      },
    },
  };
}
