// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { requestHasLocale } from 'astro:i18n';
import { detectLocale } from './i18n/detectLocale';
import { getCountry } from './utils/geo';

const LOCALE_COOKIE = 'lang';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Pre-i18n legacy redirects (old service slugs). Kept here instead of
// astro.config.mjs's `redirects` so the slug rewrite and the locale prefix
// resolve in a single 301, not two.
const LEGACY_PATH_REWRITES: Record<string, string> = {
  '/cases/': '/cases/autopodbor',
  '/de/combined/': '/de/autopodbor',
  '/rs/combined/': '/rs/autopodbor',
  '/es/combined/': '/es/autopodbor',
};

const UNLOCALIZED_PREFIXES = ['/api/'];
const UNLOCALIZED_EXACT = ['/llms.txt'];
// @astrojs/sitemap generates these as real routes (not static files under
// public/), so they pass through this middleware like any other page and
// would otherwise get wrongly redirected to a locale-prefixed 404.
const UNLOCALIZED_PATTERN = /^\/sitemap[\w-]*\.xml$/;

// ISO 3166-1 alpha-2 → site country code, for the homepage's "we detected
// you're in Germany, see our DE page" suggestion banner. Countries we don't
// serve are intentionally left unmapped — those visitors just get the
// default homepage.
const GEO_MAP: Record<string, string> = { DE: 'de', RS: 'rs', ES: 'es' };
const GEO_DISMISS_COOKIE = 'geo-banner-dismissed';

export const onRequest = defineMiddleware((context, next) => {
  const { pathname, search } = context.url;

  if (
    UNLOCALIZED_EXACT.includes(pathname) ||
    UNLOCALIZED_PREFIXES.some(p => pathname.startsWith(p)) ||
    UNLOCALIZED_PATTERN.test(pathname)
  ) {
    return next();
  }

  const rewritten = LEGACY_PATH_REWRITES[pathname] ?? pathname;

  if (rewritten === pathname && requestHasLocale(context)) {
    const locale = pathname.split('/')[1];
    context.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
    });

    const isHome = pathname === `/${locale}/` || pathname === `/${locale}`;
    if (isHome && !context.cookies.has(GEO_DISMISS_COOKIE)) {
      const ipCountry = context.request.headers.get('x-vercel-ip-country') ?? '';
      const siteCode = GEO_MAP[ipCountry.toUpperCase()];
      if (siteCode) {
        context.locals.suggestedCountry = getCountry(siteCode);
      }
    }

    return next();
  }

  const locale = detectLocale(
    context.request.headers.get('accept-language'),
    context.cookies.get(LOCALE_COOKIE)?.value
  );
  return context.redirect(`/${locale}${rewritten}${search}`, 301);
});
