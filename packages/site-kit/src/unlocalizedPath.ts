const SITEMAP_PATTERN = /^\/sitemap[\w-]*\.xml$/;

export interface UnlocalizedPaths {
  exact: readonly string[];
  prefixes: readonly string[];
}

export function createUnlocalizedMatcher({
  exact,
  prefixes,
}: UnlocalizedPaths): (pathname: string) => boolean {
  return (pathname) =>
    exact.includes(pathname) ||
    prefixes.some((prefix) => pathname.startsWith(prefix)) ||
    SITEMAP_PATTERN.test(pathname);
}
