import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { join, relative, sep } from 'node:path';
import {
  createRedirectMatcher,
  type Redirect,
} from '../../packages/site-kit/src/redirects.ts';
import { REDIRECTS } from '../../apps/approved-rs/src/redirects.ts';

const CADDY_404 = '/_image';

const REDIRECTS_BY_APP: Record<string, readonly Redirect[]> = {
  'approved-rs': REDIRECTS,
};

const PROBES: Record<string, Record<string, string>> = {
  'approved-rs': {
    'index.astro': '/',
    '404.astro': '/ru/no-such-page/',
    'admin/case-photos.astro': '/admin/case-photos',
  },
  'auto-service': {
    'index.astro': '/',
    '404.astro': '/ru/no-such-page/',
    '[locale]/cars/index.astro': '/ru/cars/',
    '[locale]/cars/[make].astro': '/ru/cars/bmw/',
    '[locale]/parts/index.astro': '/ru/parts/',
    '[locale]/parts/search.astro': '/ru/parts/search/',
    '[locale]/parts/prices.astro': '/ru/parts/prices/',
    '[locale]/parts/makes.astro': '/ru/parts/makes/',
    '[locale]/parts/[make]/index.astro': '/ru/parts/bmw/',
    '[locale]/parts/p/[slug].astro': '/ru/parts/p/bosch-0986494524/',
    '[locale]/parts/c/[slug]/[...page].astro': '/ru/parts/c/brakes/',
    '[locale]/parts/[make]/[series]/index.astro': '/ru/parts/bmw/3-series/',
    '[locale]/parts/[make]/[series]/[category].astro':
      '/ru/parts/bmw/3-series/oil-filters/',
    'admin/work-draft.astro': '/admin/work-draft',
  },
  detailing: {
    'index.astro': '/',
    '404.astro': '/sr/no-such-page/',
  },
};

export function caddyServes(files: readonly string[]): string[] {
  return files.flatMap((file) => {
    const page = /^(.*\/)index\.html$/.exec(file)?.[1];
    if (!page) return [file];
    return page === '/' ? [file, page] : [file, page, page.slice(0, -1)];
  });
}

export function shadowedRedirects(
  rules: readonly Redirect[],
  files: readonly string[],
): string[] {
  const redirectFor = createRedirectMatcher(rules);
  return caddyServes(files).filter((path) => redirectFor(path) !== null);
}

export const linksCaddy404 = (body: string) => body.includes(CADDY_404);

const UNKNOWN_SLUGS: Record<string, readonly string[]> = {
  'auto-service': [
    '/ru/parts/p/no-such-part/',
    '/ru/parts/no-such-make/',
    '/ru/parts/c/no-such-category/',
    '/ru/parts/bmw/no-such-series/',
    '/ru/cars/no-such-make/',
  ],
};

const PUBLIC_CACHE = /^public, s-maxage=\d+/;

export const cachedNotFound = (
  status: number,
  cacheControl: string | null,
  body: string,
) =>
  status === 404 &&
  PUBLIC_CACHE.test(cacheControl ?? '') &&
  body.includes('data-site-body');

export const brokenAnswer = (status: number) => status >= 500 && status !== 503;

const CADDYFILE = 'infra/auto-service-shop/caddy/Caddyfile';

const CACHED_APPS = new Set(['auto-service']);

export function catalogueCaches(caddyfile: string): (path: string) => boolean {
  const matcher = /@catalogue \{([\s\S]*?)\n\s*\}/.exec(caddyfile)?.[1] ?? '';
  const patterns = (prefix: string) =>
    [
      ...matcher.matchAll(
        new RegExp(`^\\s*${prefix}path_regexp (\\S+)$`, 'gm'),
      ),
    ].map(([, pattern]) => new RegExp(pattern));
  const kept = patterns('');
  const skipped = patterns('not ');
  return (path) =>
    kept.length > 0 &&
    kept.every((pattern) => pattern.test(path)) &&
    !skipped.some((pattern) => pattern.test(path));
}

function uncachedPublic(app: string) {
  const caches = CACHED_APPS.has(app)
    ? catalogueCaches(readFileSync(CADDYFILE, 'utf8'))
    : () => true;
  return (path: string, cacheControl: string | null) =>
    PUBLIC_CACHE.test(cacheControl ?? '') && !caches(path)
      ? [
          `${app}: ${path} answers '${cacheControl}' but the @catalogue matcher in ${CADDYFILE} never caches it`,
        ]
      : [];
}

const ON_DEMAND = /^export const prerender = false;?$/m;

function onDemandPages(pages: string): string[] {
  return readdirSync(pages, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.astro'))
    .filter((file) => ON_DEMAND.test(readFileSync(join(pages, file), 'utf8')));
}

function builtFiles(client: string): string[] {
  return readdirSync(client, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map(
      (entry) =>
        `/${relative(client, join(entry.parentPath, entry.name)).split(sep).join('/')}`,
    );
}

const freePort = () =>
  new Promise<number>((resolve) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        resolve(typeof address === 'object' && address ? address.port : 0),
      );
    });
  });

async function waitFor(base: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(base, { redirect: 'manual' });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`${base} never answered`);
}

async function probeUnknownSlugs(app: string): Promise<string[]> {
  const paths = UNKNOWN_SLUGS[app] ?? [];
  if (paths.length === 0) return [];
  const shop = createHttpServer((_, response) => {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end('{}');
  });
  await new Promise<void>((resolve) => shop.listen(0, '127.0.0.1', resolve));
  const shopAddress = shop.address();
  const shopUrl = `http://127.0.0.1:${typeof shopAddress === 'object' && shopAddress ? shopAddress.port : 0}`;
  const port = await freePort();
  const server = spawn('node', [`apps/${app}/dist/server/entry.mjs`], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      SHOP_INTERNAL_URL: shopUrl,
      MEDUSA_BACKEND_URL: shopUrl,
      MEDUSA_PUBLISHABLE_KEY: 'pk_probe',
    },
    stdio: 'ignore',
  });
  const failures: string[] = [];
  try {
    const base = `http://127.0.0.1:${port}`;
    await waitFor(base);
    const uncached = uncachedPublic(app);
    for (const path of paths) {
      const response = await fetch(base + path, { redirect: 'manual' });
      const body = await response.text();
      failures.push(...uncached(path, response.headers.get('cache-control')));
      if (
        !cachedNotFound(
          response.status,
          response.headers.get('cache-control'),
          body,
        )
      )
        failures.push(
          `${app}: ${path} answered ${response.status} with cache-control '${response.headers.get('cache-control')}', want the 404 page the cache may keep`,
        );
    }
  } finally {
    server.kill();
    shop.close();
  }
  return failures;
}

async function probeOnDemandPages(app: string): Promise<string[]> {
  const probes = PROBES[app] ?? {};
  const failures = onDemandPages(`apps/${app}/src/pages`)
    .filter((page) => !(page in probes))
    .map((page) => `${app}: on-demand page ${page} has no probe here`);
  const port = await freePort();
  const server = spawn('node', [`apps/${app}/dist/server/entry.mjs`], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: 'ignore',
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    await waitFor(base);
    const uncached = uncachedPublic(app);
    for (const path of Object.values(probes)) {
      const response = await fetch(base + path, { redirect: 'manual' });
      const body = await response.text();
      failures.push(...uncached(path, response.headers.get('cache-control')));
      if (brokenAnswer(response.status))
        failures.push(`${app}: ${path} answered ${response.status}`);
      if (linksCaddy404(body))
        failures.push(
          `${app}: ${path} links ${CADDY_404}, which Caddy answers 404`,
        );
    }
  } finally {
    server.kill();
  }
  return [...failures, ...(await probeUnknownSlugs(app))];
}

async function check(app: string): Promise<string[]> {
  const shadowed = shadowedRedirects(
    REDIRECTS_BY_APP[app] ?? [],
    builtFiles(`apps/${app}/dist/client`),
  ).map(
    (path) =>
      `${app}: Caddy serves ${path} from disk, so its redirect rule never fires: drop the file or the rule`,
  );
  return [...shadowed, ...(await probeOnDemandPages(app))];
}

if (import.meta.main) {
  const apps = process.argv.slice(2);
  if (apps.length === 0) {
    console.error('usage: caddy-split.ts <app>...');
    process.exit(2);
  }
  const failures = (await Promise.all(apps.map(check))).flat();
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log(
    `${apps.join(', ')}: no redirect rule shadowed by a built file, no on-demand page links ${CADDY_404}`,
  );
}
