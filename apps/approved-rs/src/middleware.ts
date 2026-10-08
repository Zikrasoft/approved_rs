import { defineMiddleware } from 'astro:middleware';
import { requestHasLocale } from 'astro:i18n';
import { LOCALE_COOKIE, createUnlocalizedMatcher } from '@podbor/site-kit';
import { createRedirectMatcher } from '@podbor/site-kit/redirects';
import { detectLocale } from './i18n/detectLocale';
import { REDIRECTS } from './redirects';

const redirectFor = createRedirectMatcher(REDIRECTS);

const isUnlocalized = createUnlocalizedMatcher({
  exact: ['/llms.txt', '/404', '/404/'],
  prefixes: ['/api/', '/keystatic', '/_image', '/admin/case-photos'],
});

export const onRequest = defineMiddleware((context, next) => {
  const { pathname, search } = context.url;

  if (isUnlocalized(pathname)) return next();

  const redirect = redirectFor(pathname);
  if (redirect) return context.redirect(`${redirect}${search}`, 301);

  if (requestHasLocale(context)) return next();

  const locale = detectLocale(
    context.request.headers.get('accept-language'),
    context.cookies.get(LOCALE_COOKIE)?.value,
  );
  return pathname === '/'
    ? context.rewrite(`/${locale}/${search}`)
    : context.redirect(`/${locale}${pathname}${search}`, 301);
});
