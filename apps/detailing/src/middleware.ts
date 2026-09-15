import { defineMiddleware } from 'astro:middleware';
import { detectLocale, isLocale } from './i18n/config';
import { LOCALE_COOKIE, createUnlocalizedMatcher } from '@podbor/site-kit';

export const isUnlocalized = createUnlocalizedMatcher({
  exact: ['/robots.txt', '/llms.txt', '/404', '/404/'],
  prefixes: ['/api/', '/keystatic', '/_image'],
});

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
