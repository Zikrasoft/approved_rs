import type { APIContext, AstroGlobal } from 'astro';
import { content } from '../i18n/content';
import { localeFrom, type Locale } from '../i18n/config';
import { catalogueFor, previewRequested } from './catalogueEnv';

export const PUBLIC_PAGE_CACHE = 'public, s-maxage=86400';

export const NOT_FOUND_PAGE_CACHE = 'public, s-maxage=600';

export const PREVIEW_PAGE_CACHE = 'private, no-store';

const SHOP_DOWN_FILE_CACHE = 'public, s-maxage=60';

export const RETRY_AFTER_SECONDS = 60;

export type Catalogue = NonNullable<ReturnType<typeof catalogueFor>>;

type CatalogueLoad<T> = (
  catalogue: Catalogue,
  locale: Locale,
) => Promise<T | null>;

const unavailable = (locale: Locale) =>
  new Response(content(locale).shopCart.fallbackHeading, {
    status: 503,
    headers: {
      'cache-control': 'no-store',
      'retry-after': String(RETRY_AFTER_SECONDS),
      'content-type': 'text/plain; charset=utf-8',
    },
  });

export const cacheControlOf = (request: Request, publicCache: string) =>
  previewRequested(request) ? PREVIEW_PAGE_CACHE : publicCache;

const notFound = (request: Request) =>
  new Response(null, {
    status: 404,
    headers: {
      'cache-control': cacheControlOf(request, NOT_FOUND_PAGE_CACHE),
    },
  });

export function answerPage<T>(
  { request, response }: Pick<AstroGlobal, 'request' | 'response'>,
  found: T | null,
): T | Response {
  if (found === null) return notFound(request);
  response.headers.set(
    'cache-control',
    cacheControlOf(request, PUBLIC_PAGE_CACHE),
  );
  return found;
}

async function fromCatalogue<T>(
  request: Request,
  url: URL,
  load: CatalogueLoad<T>,
): Promise<{ found: T | null } | Response> {
  const locale = localeFrom(url.pathname);
  const catalogue = catalogueFor(request);
  if (!catalogue) return unavailable(locale);
  try {
    return { found: await load(catalogue, locale) };
  } catch (error) {
    console.error(
      `catalogue page ${url.pathname} failed`,
      error instanceof Error ? error.message : String(error),
    );
    return unavailable(locale);
  }
}

export async function loadCataloguePage<T>(
  astro: Pick<AstroGlobal, 'request' | 'url' | 'response'>,
  load: CatalogueLoad<T>,
): Promise<T | Response> {
  const loaded = await fromCatalogue(astro.request, astro.url, load);
  return loaded instanceof Response ? loaded : answerPage(astro, loaded.found);
}

export async function answerCatalogueFile(
  { request, url }: Pick<APIContext, 'request' | 'url'>,
  contentType: string,
  load: CatalogueLoad<string>,
  withoutShop?: () => Promise<string | null>,
): Promise<Response> {
  const file = (found: string | null, publicCache: string) =>
    found === null
      ? notFound(request)
      : new Response(found, {
          headers: {
            'content-type': contentType,
            'cache-control': cacheControlOf(request, publicCache),
          },
        });
  const loaded = await fromCatalogue(request, url, load);
  if (!(loaded instanceof Response)) {
    return file(loaded.found, PUBLIC_PAGE_CACHE);
  }
  return withoutShop ? file(await withoutShop(), SHOP_DOWN_FILE_CACHE) : loaded;
}
