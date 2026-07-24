import { defineMiddleware } from 'astro:middleware';
import { getCountry } from './utils/geo';

// ISO 3166-1 alpha-2 → site country code. Countries we don't serve
// are intentionally left unmapped — those visitors just get the default homepage.
const GEO_MAP: Record<string, string> = {
  DE: 'de',
  RS: 'rs',
  ES: 'es',
};

const DISMISS_COOKIE = 'geo-banner-dismissed';

// Suggests a country page on the homepage instead of hard-redirecting,
// so crawlers and every visitor always get the real homepage (see SEO audit).
export const onRequest = defineMiddleware((context, next) => {
  if (context.url.pathname !== '/') return next();
  if (context.cookies.has(DISMISS_COOKIE)) return next();

  const ipCountry = context.request.headers.get('x-vercel-ip-country') ?? '';
  const siteCode = GEO_MAP[ipCountry.toUpperCase()];

  if (siteCode) {
    context.locals.suggestedCountry = getCountry(siteCode);
  }

  return next();
});
