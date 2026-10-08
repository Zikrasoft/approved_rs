import { readFileSync, writeFileSync } from 'node:fs';
import { compile, pathToRegexp, type Key } from 'path-to-regexp';

export interface Redirect {
  source: string;
  destination: string;
  permanent: boolean;
}

const ORIGIN = /^https?:\/\/[^/]+/;

function compileRule({ source, destination }: Redirect) {
  const keys: Key[] = [];
  const regex = pathToRegexp(source, keys, {
    strict: true,
    sensitive: true,
    delimiter: '/',
  });
  const indexes = Object.fromEntries(
    keys.map((key, index) => [key.name, `$${index + 1}`]),
  );
  const origin = ORIGIN.exec(destination)?.[0] ?? '';
  const location =
    origin +
    compile(destination.slice(origin.length), { validate: false })(indexes);
  return { regex, location };
}

export function createRedirectMatcher(
  rules: readonly Redirect[],
): (pathname: string) => string | null {
  const compiled = rules.map(compileRule);
  return (pathname) => {
    for (const { regex, location } of compiled) {
      const match = regex.exec(pathname);
      if (match) {
        return location.replace(
          /\$(\d+)/g,
          (_, index: string) => match[Number(index)] ?? '',
        );
      }
    }
    return null;
  };
}

export function withRedirects(
  vercelJson: string,
  redirects: readonly Redirect[],
): string {
  return `${JSON.stringify({ ...JSON.parse(vercelJson), redirects }, null, 2)}\n`;
}

export function writeRedirects(
  vercelJson: URL,
  redirects: readonly Redirect[],
): void {
  writeFileSync(
    vercelJson,
    withRedirects(readFileSync(vercelJson, 'utf8'), redirects),
  );
}

type PathBuilders<L extends string> = Record<
  string,
  { build(locale: L, ...params: string[]): string }['build']
>;

export function unprefixedSectionRedirects<L extends string>(
  paths: PathBuilders<L>,
  locale: L,
): Redirect[] {
  const nestedBySection = new Map<string, boolean>();
  for (const build of Object.values(paths)) {
    const [, , section, ...rest] = build(locale, '_', '_', '_').split('/');
    if (section && !section.includes('.')) {
      nestedBySection.set(
        section,
        Boolean(nestedBySection.get(section)) || rest.some(Boolean),
      );
    }
  }
  return [...nestedBySection].flatMap(([section, nested]) =>
    nested
      ? [
          {
            source: `/${section}/:path*`,
            destination: `/${locale}/${section}/:path*`,
            permanent: true,
          },
        ]
      : [`/${section}`, `/${section}/`].map((source) => ({
          source,
          destination: `/${locale}/${section}/`,
          permanent: true,
        })),
  );
}
