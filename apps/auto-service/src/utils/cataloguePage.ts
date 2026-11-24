import type { AstroGlobal } from 'astro';
import { content } from '../i18n/content';
import { localeFrom, type Locale } from '../i18n/config';
import { catalogueFor, previewRequested } from './catalogueEnv';

export const PUBLIC_PAGE_CACHE =
  'public, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=86400';

export const PREVIEW_PAGE_CACHE = 'private, no-store';

export const RETRY_AFTER_SECONDS = 60;

type Catalogue = NonNullable<ReturnType<typeof catalogueFor>>;

const unavailable = (locale: Locale) =>
  new Response(content(locale).shopCart.fallbackHeading, {
    status: 503,
    headers: {
      'cache-control': 'no-store',
      'retry-after': String(RETRY_AFTER_SECONDS),
      'content-type': 'text/plain; charset=utf-8',
    },
  });

export async function loadCataloguePage<T>(
  { request, url, response }: Pick<AstroGlobal, 'request' | 'url' | 'response'>,
  load: (catalogue: Catalogue, locale: Locale) => Promise<T | null>,
): Promise<T | Response> {
  const locale = localeFrom(url.pathname);
  const cacheControl = previewRequested(request)
    ? PREVIEW_PAGE_CACHE
    : PUBLIC_PAGE_CACHE;
  const catalogue = catalogueFor(request);
  if (!catalogue) return unavailable(locale);
  let found: T | null;
  try {
    found = await load(catalogue, locale);
  } catch (error) {
    console.error(
      `catalogue page ${url.pathname} failed`,
      error instanceof Error ? error.message : String(error),
    );
    return unavailable(locale);
  }
  if (found === null) {
    return new Response(null, {
      status: 404,
      headers: { 'cache-control': cacheControl },
    });
  }
  response.headers.set('cache-control', cacheControl);
  return found;
}
