// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { requestHasLocale } from 'astro:i18n';
import { detectLocale } from './i18n/detectLocale';

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

export const onRequest = defineMiddleware((context, next) => {
  const { pathname, search } = context.url;

  if (UNLOCALIZED_EXACT.includes(pathname) || UNLOCALIZED_PREFIXES.some(p => pathname.startsWith(p))) {
    return next();
  }

  const rewritten = LEGACY_PATH_REWRITES[pathname] ?? pathname;

  if (rewritten === pathname && requestHasLocale(context)) {
    context.cookies.set(LOCALE_COOKIE, pathname.split('/')[1], {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
    });
    return next();
  }

  const locale = detectLocale(
    context.request.headers.get('accept-language'),
    context.cookies.get(LOCALE_COOKIE)?.value
  );
  return context.redirect(`/${locale}${rewritten}${search}`, 301);
});
