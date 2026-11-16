import { compile, pathToRegexp, type Key } from 'path-to-regexp';

export interface Redirect {
  source: string;
  destination: string;
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

function servedPaths(file: string): string[] {
  const page = /^(.*\/)index\.html$/.exec(file)?.[1];
  if (!page) return [file];
  return page === '/' ? [file, page] : [file, page, page.slice(0, -1)];
}

export function shadowedRedirects(
  rules: readonly Redirect[],
  files: readonly string[],
): string[] {
  const redirectFor = createRedirectMatcher(rules);
  return files
    .flatMap(servedPaths)
    .filter((path) => redirectFor(path) !== null);
}
