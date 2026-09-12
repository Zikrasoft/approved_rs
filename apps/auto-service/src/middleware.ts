import { defineMiddleware } from 'astro:middleware';
import { detectLocale, isLocale } from './i18n/config';

const LOCALE_COOKIE = 'lang';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const UNLOCALIZED_PREFIXES = ['/api/', '/keystatic', '/_image'];
const UNLOCALIZED_EXACT = ['/robots.txt', '/404', '/404/'];
const UNLOCALIZED_PATTERN = /^\/sitemap[\w-]*\.xml$/;

export function isUnlocalized(pathname: string): boolean {
  return (
    UNLOCALIZED_EXACT.includes(pathname) ||
    UNLOCALIZED_PREFIXES.some((p) => pathname.startsWith(p)) ||
    UNLOCALIZED_PATTERN.test(pathname)
  );
}

export const onRequest = defineMiddleware((context, next) => {
  const { pathname, search } = context.url;

  if (isUnlocalized(pathname)) return next();

  const firstSegment = pathname.split('/')[1] ?? '';
  if (isLocale(firstSegment)) {
    context.cookies.set(LOCALE_COOKIE, firstSegment, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
    });
    return next();
  }

  const locale = detectLocale(
    context.request.headers.get('accept-language'),
    context.cookies.get(LOCALE_COOKIE)?.value,
  );

  if (pathname === '/') {
    context.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
    });
    return context.redirect(`/${locale}/${search}`, 302);
  }

  return context.redirect(`/${locale}${pathname}${search}`, 302);
});
