import { defineMiddleware } from 'astro:middleware';
import { detectLocale, isLocale } from './i18n/config';
import { LOCALE_COOKIE } from '@podbor/site-kit';

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
  if (isLocale(firstSegment)) return next();

  const locale = detectLocale(
    context.request.headers.get('accept-language'),
    context.cookies.get(LOCALE_COOKIE)?.value,
  );

  if (pathname === '/') return context.redirect(`/${locale}/${search}`, 302);

  return context.redirect(`/${locale}${pathname}${search}`, 302);
});
