import { LOCALE_COOKIE } from './localeCookie.ts';
import { createRedirectMatcher, type Redirect } from './redirects.ts';

export interface LocaleMiddlewareContext<Redirected> {
  url: URL;
  request: { headers: { get(name: string): string | null } };
  cookies: { get(name: string): { value: string } | undefined };
  redirect(path: string, status: 301 | 302): Redirected;
}

export interface LocaleMiddlewareOptions {
  locales: {
    isLocale(value: string): boolean;
    detectLocale(
      acceptLanguage: string | null,
      cookie: string | undefined,
    ): string;
  };
  unlocalized?: { prefixes?: readonly string[] };
  redirects?: readonly Redirect[];
}

const UNLOCALIZED_EXACT = ['/404', '/404/'];
const UNLOCALIZED_PREFIXES = ['/api/', '/keystatic', '/.well-known/'];
const FILE_NAME = /\/[^/]*\.[^/]*$/;

export function createLocaleMiddleware({
  locales: { isLocale, detectLocale },
  unlocalized: { prefixes = [] } = {},
  redirects = [],
}: LocaleMiddlewareOptions) {
  const unlocalizedPrefixes = [...UNLOCALIZED_PREFIXES, ...prefixes];
  const isUnlocalized = (pathname: string) =>
    UNLOCALIZED_EXACT.includes(pathname) ||
    unlocalizedPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    FILE_NAME.test(pathname);
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
