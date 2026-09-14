import type { APIContext } from 'astro';
import { defineMiddleware } from 'astro:middleware';
import { requestHasLocale } from 'astro:i18n';
import { BRAND_SITES, brandLocale } from '@podbor/brands';
import { LOCALE_COOKIE } from '@podbor/site-kit';
import { detectLocale } from './i18n/detectLocale';
import { SUPPORTED_LOCALES } from './i18n/config';
import { getCountry } from './utils/geo';

// Pre-i18n legacy redirects (old service slugs). Kept here instead of
// astro.config.mjs's `redirects` so the slug rewrite and the locale prefix
// resolve in a single 301, not two.
const LEGACY_PATH_REWRITES: Record<string, string> = {
  '/cases/': '/cases/autopodbor',
  '/de/combined/': '/autopodbor/de',
  '/rs/combined/': '/autopodbor/rs',
  '/es/combined/': '/autopodbor/es',
  // Old per-country delivery pages, content merged into /autopodbor/<country>.
  '/rs/dostavka/': '/autopodbor/rs',
  '/es/dostavka/': '/autopodbor/es',
  // Old country-first sourcing pages (word order was <country>/autopodbor/,
  // not today's <service>/<country>/) — same destination as combined/dostavka above.
  '/de/autopodbor/': '/autopodbor/de',
  '/rs/autopodbor/': '/autopodbor/rs',
  '/es/autopodbor/': '/autopodbor/es',
  // Old case slugs, content no longer exists — send to the cases list instead of 404.
  '/cases/mercedes-c-2021-de/': '/cases/autopodbor',
  '/cases/ford-focus-2020-rs/': '/cases/autopodbor',
  '/cases/vw-golf-2022-rs/': '/cases/autopodbor',
  '/cases/bmw-x5-2023-de/': '/cases/autopodbor',
  '/cases/audi-a4-2022-de/': '/cases/autopodbor',
};

// Service-slug English migration (was Russian-transliterated). Unlike
// LEGACY_PATH_REWRITES above (exact, unprefixed-path match, written for
// pre-i18n URLs that never had a locale segment), these old URLs already
// carry a locale prefix and have dynamic country/city/case-slug tails — so
// this is a generic per-segment rename instead of enumerating every path.
const SLUG_RENAMES: Record<string, string> = {
  autopodbor: 'vehicle-sourcing',
  privoz: 'vehicle-import',
  vykup: 'vehicle-buyback',
  proverka: 'vehicle-inspection',
};

export function renameSlugSegments(pathname: string): string | null {
  let changed = false;
  const renamed = pathname.split('/').map((seg) => {
    if (Object.hasOwn(SLUG_RENAMES, seg)) {
      changed = true;
      return SLUG_RENAMES[seg];
    }
    return seg;
  });
  return changed ? renamed.join('/') : null;
}

const MOVED_BRAND_HOSTS: Record<string, string> = {
  'auto-service-belgrade': BRAND_SITES.carlab,
  'avtoservis-belgrade': BRAND_SITES.carlab,
  'detailing-belgrade': BRAND_SITES.details,
  'wrapping-belgrade': BRAND_SITES.details,
};
const MOVED_BRAND_CASE_TABS: Record<string, string> = {
  'auto-service': BRAND_SITES.carlab,
  autoservice: BRAND_SITES.carlab,
  detailing: BRAND_SITES.details,
};

export function movedBrandUrl(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  const hasLocale = (SUPPORTED_LOCALES as readonly string[]).includes(
    segments[0],
  );
  const locale = hasLocale ? segments[0] : 'ru';
  const path = hasLocale ? segments.slice(1) : segments;
  const target = brandLocale(locale);

  if (Object.hasOwn(MOVED_BRAND_HOSTS, path[0] ?? '')) {
    const host = MOVED_BRAND_HOSTS[path[0]];
    const rest = path.slice(1);
    return rest.length
      ? `${host}/${target}/works/${rest.join('/')}/`
      : `${host}/${target}/`;
  }
  if (
    path.length === 2 &&
    path[0] === 'cases' &&
    Object.hasOwn(MOVED_BRAND_CASE_TABS, path[1])
  ) {
    return `${MOVED_BRAND_CASE_TABS[path[1]]}/${target}/works/`;
  }
  return null;
}

// The Germany vehicle-import spoke moved under the EU one (/vehicle-import/eu/de/,
// was /vehicle-import/de/) — an inserted segment, not a 1-for-1 rename, so it
// doesn't fit SLUG_RENAMES above. Suffix match (not exact) so it also catches
// the path post-slug-rename (see onRequest) without needing its own locale handling.
const OLD_DE_SPOKE_PATH = '/vehicle-import/de/';
const NEW_DE_SPOKE_PATH = '/vehicle-import/eu/de/';

export function moveGermanySpoke(pathname: string): string | null {
  // Normalize a missing trailing slash before matching — trailingSlash is
  // "ignore" (astro.config.mjs), so `/en/vehicle-import/de` (no slash) is a
  // real, reachable URL too, not just `/en/vehicle-import/de/`.
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return normalized.endsWith(OLD_DE_SPOKE_PATH)
    ? normalized.slice(0, -OLD_DE_SPOKE_PATH.length) + NEW_DE_SPOKE_PATH
    : null;
}

// Buyback ran a page per country whose only difference was a substituted
// country name. Serbia keeps its page (Serbian plates are a different offer);
// the rest collapse onto the hub.
const BUYBACK_COLLAPSED_COUNTRIES = ['de', 'es', 'ch', 'pt', 'fr', 'it', 'pl'];

export function collapseBuybackCountry(pathname: string): string | null {
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const match = BUYBACK_COLLAPSED_COUNTRIES.find((code) =>
    normalized.endsWith(`/vehicle-buyback/${code}/`),
  );
  return match
    ? normalized.slice(0, -(match.length + 1)) // drop "<code>/"
    : null;
}

// No trailing slash on '/keystatic': the CMS admin's own root route is the
// bare path (no trailing slash) before Keystatic does its own internal
// routing, so a trailing-slash prefix would miss it.
// '/_image' is Astro's built-in on-demand image-transform endpoint (used in
// dev always, and in prod for any non-prerendered route) — locale-prefixing
// it breaks every <Image> on the site, since the endpoint only exists at
// the bare path.
// '/admin/case-photos' is the gallery-upload admin tool (see
// pages/admin/case-photos.astro) — same reasoning as '/keystatic', it's a tool
// page outside the [locale] tree, not a translated site page.
const UNLOCALIZED_PREFIXES = [
  '/api/',
  '/keystatic',
  '/_image',
  '/admin/case-photos',
];
// '/404' is Astro's special not-found route — it's baked verbatim into
// dist/client/404.html, the file every static host (Vercel included) falls
// back to for ANY unmatched path. Redirecting it here corrupts that single
// file into a "Redirecting to /ru/404/" stub, breaking 404 handling
// sitewide instead of just for literal /404 visits.
const UNLOCALIZED_EXACT = ['/llms.txt', '/404', '/404/'];
// @astrojs/sitemap generates these as real routes (not static files under
// public/), so they pass through this middleware like any other page and
// would otherwise get wrongly redirected to a locale-prefixed 404.
const UNLOCALIZED_PATTERN = /^\/sitemap[\w-]*\.xml$/;

// ISO 3166-1 alpha-2 → site country code, for the homepage's "we detected
// you're in Germany, see our DE page" suggestion banner. Countries we don't
// serve are intentionally left unmapped — those visitors just get the
// default homepage.
const GEO_MAP: Record<string, string> = {
  DE: 'de',
  RS: 'rs',
  ES: 'es',
  FR: 'fr',
  IT: 'it',
  PL: 'pl',
};
const GEO_DISMISS_COOKIE = 'geo-banner-dismissed';

function applyGeoSuggestion(context: APIContext): void {
  if (context.cookies.has(GEO_DISMISS_COOKIE)) return;
  const ipCountry = context.request.headers.get('x-vercel-ip-country') ?? '';
  const siteCode = GEO_MAP[ipCountry.toUpperCase()];
  if (siteCode) context.locals.suggestedCountry = getCountry(siteCode);
}

export const onRequest = defineMiddleware((context, next) => {
  const { pathname, search } = context.url;

  if (
    UNLOCALIZED_EXACT.includes(pathname) ||
    UNLOCALIZED_PREFIXES.some((p) => pathname.startsWith(p)) ||
    UNLOCALIZED_PATTERN.test(pathname)
  ) {
    return next();
  }

  const movedBrand = movedBrandUrl(pathname);
  if (movedBrand) return context.redirect(`${movedBrand}${search}`, 301);

  // Bare '/' serves the detected locale's homepage directly (content of
  // /ru/, /en/, etc.) instead of a 301 to it — the URL bar stays on '/'.
  // The page's own canonical tag still points at /<locale>/, so crawlers
  // see one canonical URL and there's no duplicate-content problem; this
  // is purely for visitors who don't want to see the prefix hop.
  if (pathname === '/') {
    const locale = detectLocale(
      context.request.headers.get('accept-language'),
      context.cookies.get(LOCALE_COOKIE)?.value,
    );
    applyGeoSuggestion(context);

    return context.rewrite(`/${locale}/${search}`);
  }

  const rewritten = LEGACY_PATH_REWRITES[pathname] ?? pathname;

  // Checked separately from the block below: an already-locale-prefixed old
  // URL (e.g. /en/autopodbor/de/) must keep that exact locale — re-running
  // detectLocale() here and prepending its result on top of the existing
  // prefix would double it up (/ru/en/vehicle-sourcing/de/) whenever the
  // visitor's current browser/cookie locale differs from the one baked
  // into the stale link they clicked.
  const slugRenamed = renameSlugSegments(rewritten);
  const afterSlugRename = slugRenamed ?? rewritten;
  const restructured =
    moveGermanySpoke(afterSlugRename) ??
    collapseBuybackCountry(afterSlugRename) ??
    slugRenamed;
  if (restructured) {
    if (requestHasLocale(context)) {
      return context.redirect(`${restructured}${search}`, 301);
    }
    const locale = detectLocale(
      context.request.headers.get('accept-language'),
      context.cookies.get(LOCALE_COOKIE)?.value,
    );
    return context.redirect(`/${locale}${restructured}${search}`, 301);
  }

  if (rewritten === pathname && requestHasLocale(context)) {
    const locale = pathname.split('/')[1];
    const isHome = pathname === `/${locale}/` || pathname === `/${locale}`;
    if (isHome) applyGeoSuggestion(context);

    return next();
  }

  // Same production caveat as the legacy-slug redirects above: this branch
  // only fires for requests that reach this middleware at all. On Vercel,
  // an unprefixed path to a real content page (e.g. /vehicle-sourcing/rs/)
  // has no matching route either, so it 404s at the edge before ever
  // getting here — vercel.json's catch-all redirects (one per top-level
  // route) are the ones that actually fire in production for that case;
  // this stays for local dev and Accept-Language-aware detection (Vercel's
  // static redirects always fall back to the default locale, this doesn't).
  const locale = detectLocale(
    context.request.headers.get('accept-language'),
    context.cookies.get(LOCALE_COOKIE)?.value,
  );
  return context.redirect(`/${locale}${rewritten}${search}`, 301);
});
