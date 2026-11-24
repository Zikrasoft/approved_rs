import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
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

export const brokenAnswer = (status: number) => status >= 500 && status !== 503;

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
    for (const path of Object.values(probes)) {
      const response = await fetch(base + path, { redirect: 'manual' });
      const body = await response.text();
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
  return failures;
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
