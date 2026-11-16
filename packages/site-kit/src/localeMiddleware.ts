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
  locales: {
    isLocale(value: string): boolean;
    detectLocale(
      acceptLanguage: string | null,
      cookie: string | undefined,
    ): string;
  };
  unlocalized?: Partial<UnlocalizedPaths>;
  redirects?: readonly Redirect[];
}

const EVERY_SITE: UnlocalizedPaths = {
  exact: ['/llms.txt', '/robots.txt', '/favicon.ico', '/404', '/404/'],
  prefixes: ['/api/', '/keystatic', '/.well-known/', '/_astro/'],
};

export function createLocaleMiddleware({
  locales: { isLocale, detectLocale },
  unlocalized: { exact = [], prefixes = [] } = {},
  redirects = [],
}: LocaleMiddlewareOptions) {
  const isUnlocalized = createUnlocalizedMatcher({
    exact: [...EVERY_SITE.exact, ...exact],
    prefixes: [...EVERY_SITE.prefixes, ...prefixes],
  });
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
