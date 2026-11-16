import { LOCALE_COOKIE } from './localeCookie.ts';
import { createRedirectMatcher, type Redirect } from './redirects.ts';
import {
  createUnlocalizedMatcher,
  type UnlocalizedPaths,
} from './unlocalizedPath.ts';

export interface LocaleMiddlewareContext<Redirected> {
  url: URL;
  request: { headers: { get(name: string): string | null } };
  cookies: { get(name: string): { value: string } | undefined };
  redirect(path: string, status: 301 | 302): Redirected;
}

export interface LocaleMiddlewareOptions {
  isLocale(value: string): boolean;
  detectLocale(
    acceptLanguage: string | null,
    cookie: string | undefined,
  ): string;
  unlocalized: UnlocalizedPaths;
  redirects?: readonly Redirect[];
}

export function createLocaleMiddleware({
  isLocale,
  detectLocale,
  unlocalized,
  redirects = [],
}: LocaleMiddlewareOptions) {
  const isUnlocalized = createUnlocalizedMatcher(unlocalized);
  const redirectFor = createRedirectMatcher(redirects);

  return <Redirected, Next>(
    context: LocaleMiddlewareContext<Redirected>,
    next: () => Next,
  ): Redirected | Next => {
    const { pathname, search } = context.url;

    if (isUnlocalized(pathname)) return next();

    const redirect = redirectFor(pathname);
    if (redirect) return context.redirect(`${redirect}${search}`, 301);

    if (isLocale(pathname.split('/')[1]!)) return next();

    const locale = detectLocale(
      context.request.headers.get('accept-language'),
      context.cookies.get(LOCALE_COOKIE)?.value,
    );
    return context.redirect(`/${locale}${pathname}${search}`, 302);
  };
}
