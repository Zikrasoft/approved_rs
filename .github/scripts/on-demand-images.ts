import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';

const PROBES: Record<string, Record<string, string>> = {
  'approved-rs': {
    'index.astro': '/',
    'admin/case-photos.astro': '/admin/case-photos',
  },
  'auto-service': {
    'index.astro': '/',
    '[locale]/parts/search.astro': '/ru/parts/search/',
    '[locale]/parts/prices.astro': '/ru/parts/prices/',
    'admin/work-draft.astro': '/admin/work-draft',
  },
  detailing: {
    'index.astro': '/',
  },
};

const ON_DEMAND = /^export const prerender = false;?$/m;

function onDemandPages(pages: string): string[] {
  return readdirSync(pages, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.astro'))
    .filter((file) => ON_DEMAND.test(readFileSync(join(pages, file), 'utf8')));
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

async function check(app: string): Promise<string[]> {
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
      if (response.status >= 500)
        failures.push(`${app}: ${path} answered ${response.status}`);
      if (body.includes('/_image'))
        failures.push(`${app}: ${path} links /_image, which Caddy answers 404`);
    }
  } finally {
    server.kill();
  }
  return failures;
}

const apps = process.argv.slice(2);
if (apps.length === 0) {
  console.error('usage: on-demand-images.ts <app>...');
  process.exit(2);
}
const failures = (await Promise.all(apps.map(check))).flat();
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`no on-demand page links /_image in ${apps.join(', ')}`);
