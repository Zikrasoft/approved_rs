import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../integration-tests/adminAuth';
import { crawledSupplierAdapter } from '../adapter';
import { crawlSite } from '../crawl';
import type { CrawledSite } from '../site';
import { mannFilter } from '../sites/mann-filter';
import { crawlStore, type CrawlStore } from '../store';

type Responder = () => Response;

const START = Date.parse('2026-10-25T00:00:00Z');
const HOUR = 60 * 60 * 1000;

const fakeWeb = (routes: Record<string, Responder | Responder[]>) => {
  const requests: { url: string; at: number; headers: Headers }[] = [];
  const served = new Map<string, number>();
  const clock = {
    time: START,
    now: () => clock.time,
    sleep: async (ms: number) => {
      clock.time += ms;
    },
  };
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, at: clock.time, headers: new Headers(init?.headers) });
    const route = routes[url];
    if (!route) return new Response('', { status: 404 });
    if (!Array.isArray(route)) return route();
    const index = served.get(url) ?? 0;
    served.set(url, index + 1);
    return route[Math.min(index, route.length - 1)]();
  }) as typeof globalThis.fetch;
  const fetched = (url: string) =>
    requests.filter((request) => request.url === url);
  return { requests, clock, fetch, fetched };
};

const ok =
  (body: string, headers: Record<string, string> = {}): Responder =>
  () =>
    new Response(body, { status: 200, headers });
const status =
  (code: number, headers: Record<string, string> = {}): Responder =>
  () =>
    new Response('', { status: code, headers });
const urlset = (...urls: string[]) =>
  `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
    .map((url) => `<url><loc>${url}</loc></url>`)
    .join('')}</urlset>`;

const testSite = (name: string, floorMs = 2000): CrawledSite => ({
  key: 'mann-filter',
  name,
  origin: `https://${name}.test`,
  sitemaps: [`https://${name}.test/sitemap.xml`],
  floorMs,
  isPage: (url) => url.includes('/p/'),
  parse: () => null,
});

const ADMIN_EMAIL = 'admin@crawler-tests.local';
const ADMIN_PASSWORD = 'supersecret';

medusaIntegrationTestRunner({
  moduleName: 'crawler',
  testSuite: ({ api, getContainer }) => {
    let store: CrawlStore;

    beforeAll(() => {
      store = crawlStore(
        getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION),
      );
    });

    const crawl = async (
      site: CrawledSite,
      web: ReturnType<typeof fakeWeb>,
    ) => {
      await store.start(site.name, new Date(web.clock.now()));
      await crawlSite(site, {
        store,
        fetch: web.fetch,
        clock: web.clock,
        from: 'crawler@carlab.test',
        random: () => 0,
      });
      const [progress] = await store.progress([site.name]);
      return progress;
    };

    describe('crawlSite', () => {
      it('reads robots.txt first, names itself and keeps the Crawl-delay between requests', async () => {
        const site = testSite('polite');
        const page = (n: number) => `https://polite.test/p/${n}`;
        const web = fakeWeb({
          'https://polite.test/robots.txt': ok(
            'User-agent: *\nCrawl-delay: 3\n',
          ),
          'https://polite.test/sitemap.xml': ok(
            urlset(page(1), 'https://polite.test/about', page(2)),
          ),
          [page(1)]: ok('<html>one</html>', { etag: '"1"' }),
          [page(2)]: ok('<html>two</html>'),
        });

        const progress = await crawl(site, web);

        expect(web.requests.map(({ url }) => url)).toEqual([
          'https://polite.test/robots.txt',
          'https://polite.test/sitemap.xml',
          page(1),
          page(2),
        ]);
        const gaps = web.requests
          .slice(1)
          .map(({ at }, index) => at - web.requests[index].at);
        expect(gaps).toEqual([3000, 3000, 3000]);
        for (const { headers } of web.requests) {
          expect(headers.get('user-agent')).toMatch(
            /^CarLabCatalogBot\/1\.0 \(\+https:\/\/carlab\.rs\//u,
          );
          expect(headers.get('from')).toBe('crawler@carlab.test');
        }
        expect(progress.run?.status).toBe('done');
        expect(progress.pages).toEqual({
          queued: 0,
          done: 2,
          failed: 0,
          gone: 0,
        });
        const [snapshot] = await store.snapshots(site.name, null, 1);
        expect(gunzipSync(snapshot.body).toString('utf8')).toBe(
          '<html>one</html>',
        );
      });

      it('never waits less than the site floor when robots.txt asks for less', async () => {
        const site = testSite('floor', 5000);
        const web = fakeWeb({
          'https://floor.test/robots.txt': ok(
            'User-agent: *\nCrawl-delay: 1\n',
          ),
          'https://floor.test/sitemap.xml': ok(
            urlset('https://floor.test/p/1'),
          ),
          'https://floor.test/p/1': ok('one'),
        });

        await crawl(site, web);

        expect(web.requests.map(({ at }) => at - START)).toEqual([
          0, 5000, 10000,
        ]);
      });

      it('never fetches a page robots.txt disallows', async () => {
        const site = testSite('disallow');
        const web = fakeWeb({
          'https://disallow.test/robots.txt': ok(
            'User-agent: *\nDisallow: /p/secret\n',
          ),
          'https://disallow.test/sitemap.xml': ok(
            urlset(
              'https://disallow.test/p/1',
              'https://disallow.test/p/secret',
            ),
          ),
          'https://disallow.test/p/1': ok('one'),
          'https://disallow.test/p/secret': ok('secret'),
        });

        const progress = await crawl(site, web);

        expect(web.fetched('https://disallow.test/p/secret')).toEqual([]);
        expect(progress.pages).toMatchObject({ done: 1, failed: 1 });
      });

      it('pauses on a 403 and resumes where it stopped', async () => {
        const site = testSite('forbidden');
        const page = (n: number) => `https://forbidden.test/p/${n}`;
        const web = fakeWeb({
          'https://forbidden.test/robots.txt': ok(''),
          'https://forbidden.test/sitemap.xml': ok(
            urlset(page(1), page(2), page(3)),
          ),
          [page(1)]: ok('one'),
          [page(2)]: [status(403), ok('two')],
          [page(3)]: ok('three'),
        });

        const paused = await crawl(site, web);

        expect(paused.run).toMatchObject({
          status: 'paused',
          paused_reason: 'forbidden',
        });
        expect(web.fetched(page(3))).toEqual([]);
        expect(paused.pages).toMatchObject({ done: 1, queued: 2 });

        const resumed = await crawl(site, web);

        expect(resumed.run?.status).toBe('done');
        expect(web.fetched('https://forbidden.test/sitemap.xml')).toHaveLength(
          1,
        );
        expect(web.fetched(page(1))).toHaveLength(1);
        expect(resumed.pages).toMatchObject({ done: 3, queued: 0 });
      });

      it('pauses on a challenge page instead of storing it', async () => {
        const site = testSite('challenge');
        const web = fakeWeb({
          'https://challenge.test/robots.txt': ok(''),
          'https://challenge.test/sitemap.xml': ok(
            urlset('https://challenge.test/p/1', 'https://challenge.test/p/2'),
          ),
          'https://challenge.test/p/1': ok(
            '<html><head><title>Just a moment...</title></head></html>',
          ),
        });

        const progress = await crawl(site, web);

        expect(progress.run).toMatchObject({
          status: 'paused',
          paused_reason: 'challenge',
        });
        expect(web.fetched('https://challenge.test/p/2')).toEqual([]);
        expect(await store.snapshots(site.name, null, 10)).toEqual([]);
      });

      it('waits out Retry-After, in seconds or as a date, before the next request', async () => {
        const site = testSite('retry');
        const page = (n: number) => `https://retry.test/p/${n}`;
        const web = fakeWeb({
          'https://retry.test/robots.txt': ok(''),
          'https://retry.test/sitemap.xml': ok(urlset(page(1), page(2))),
          [page(1)]: [status(429, { 'retry-after': '120' }), ok('one')],
          [page(2)]: [
            () =>
              new Response('', {
                status: 503,
                headers: {
                  'retry-after': new Date(web.clock.now() + HOUR).toUTCString(),
                },
              }),
            ok('two'),
          ],
        });

        const progress = await crawl(site, web);

        const [first429, retried] = web.fetched(page(1));
        expect(retried.at - first429.at).toBeGreaterThanOrEqual(120_000);
        const [first503, again] = web.fetched(page(2));
        expect(again.at - first503.at).toBeGreaterThanOrEqual(HOUR - 1000);
        const sorted = web.requests.map(({ at }) => at);
        const nextAfter503 = sorted.find((at) => at > first503.at)!;
        expect(nextAfter503 - first503.at).toBeGreaterThanOrEqual(HOUR - 1000);
        expect(progress.pages).toMatchObject({ done: 2 });
      });

      it('pauses after five server errors in a row', async () => {
        const site = testSite('broken');
        const pages = [1, 2, 3, 4, 5, 6].map(
          (n) => `https://broken.test/p/${n}`,
        );
        const web = fakeWeb({
          'https://broken.test/robots.txt': ok(''),
          'https://broken.test/sitemap.xml': ok(urlset(...pages)),
          ...Object.fromEntries(pages.map((url) => [url, status(500)])),
        });

        const progress = await crawl(site, web);

        expect(progress.run).toMatchObject({
          status: 'paused',
          paused_reason: 'server_errors',
        });
        expect(web.requests).toHaveLength(2 + 5);
      });

      it('marks a page gone on 404', async () => {
        const site = testSite('gone');
        const web = fakeWeb({
          'https://gone.test/robots.txt': ok(''),
          'https://gone.test/sitemap.xml': ok(urlset('https://gone.test/p/1')),
        });

        const progress = await crawl(site, web);

        expect(progress.pages).toMatchObject({ gone: 1 });
      });

      it('pauses when robots.txt fails with a server error', async () => {
        const site = testSite('norobots');
        const web = fakeWeb({
          'https://norobots.test/robots.txt': status(503),
          'https://norobots.test/sitemap.xml': ok(
            urlset('https://norobots.test/p/1'),
          ),
        });

        const progress = await crawl(site, web);

        expect(progress.run).toMatchObject({
          status: 'paused',
          paused_reason: 'robots_unavailable',
        });
        expect(web.requests).toHaveLength(1);
      });

      it('reads a missing robots.txt as allowing everything', async () => {
        const site = testSite('missing');
        const web = fakeWeb({
          'https://missing.test/sitemap.xml': ok(
            urlset('https://missing.test/p/1'),
          ),
          'https://missing.test/p/1': ok('one'),
        });

        const progress = await crawl(site, web);

        expect(progress.pages).toMatchObject({ done: 1 });
      });

      it('follows a sitemap index into its sitemaps', async () => {
        const site = testSite('indexed');
        const web = fakeWeb({
          'https://indexed.test/robots.txt': ok(''),
          'https://indexed.test/sitemap.xml': ok(
            '<sitemapindex><sitemap><loc>https://indexed.test/a.xml</loc></sitemap></sitemapindex>',
          ),
          'https://indexed.test/a.xml': ok(urlset('https://indexed.test/p/1')),
          'https://indexed.test/p/1': ok('one'),
        });

        const progress = await crawl(site, web);

        expect(progress.pages).toMatchObject({ done: 1 });
      });

      it('re-reads robots.txt once a day during a long run', async () => {
        const site = testSite('daily', 13 * HOUR);
        const web = fakeWeb({
          'https://daily.test/robots.txt': ok(''),
          'https://daily.test/sitemap.xml': ok(
            urlset('https://daily.test/p/1', 'https://daily.test/p/2'),
          ),
          'https://daily.test/p/1': ok('one'),
          'https://daily.test/p/2': ok('two'),
        });

        await crawl(site, web);

        const robots = web.fetched('https://daily.test/robots.txt');
        expect(robots).toHaveLength(2);
        expect(robots[1].at - robots[0].at).toBeGreaterThanOrEqual(24 * HOUR);
      });
    });

    describe('crawled Supplier adapter', () => {
      it('reads the stored MANN-FILTER pages into articles, page by page, with no quotes', async () => {
        const fixture = (name: string) =>
          readFileSync(join(__dirname, 'fixtures', 'mann-filter', name));
        const pages = {
          'https://www.mann-filter.com/en/catalog/search-results/product.html/c30005_mann-filter.html':
            fixture('c30005.html.gz'),
          'https://www.mann-filter.com/en/catalog/search-results/product.html/hu816x_mann-filter.html':
            fixture('hu816x.html.gz'),
        };
        await store.start(mannFilter.name, new Date(START));
        await store.seed(mannFilter.name, Object.keys(pages), new Date(START));
        for (const [url, body] of Object.entries(pages)) {
          await store.update(mannFilter.name, url, { status: 'done', body });
        }
        const adapter = crawledSupplierAdapter(mannFilter, store, 1);

        const first = await adapter.listCatalogue(null);
        const second = await adapter.listCatalogue(first.next);
        const last = await adapter.listCatalogue(second.next);

        expect(adapter.name).toBe('MANN-FILTER');
        expect(
          [...first.articles, ...second.articles].map(({ number }) => number),
        ).toEqual(['C 30 005', 'HU 816 x']);
        expect(last).toEqual({ articles: [], next: null });
        expect(await adapter.quote(['HU816X_MANN-FILTER'])).toEqual([]);
      });
    });

    describe('/admin/crawls', () => {
      let adminHeaders: { headers: { authorization: string } };
      const previous = process.env.SUPPLIER_ADAPTERS;

      beforeAll(async () => {
        process.env.SUPPLIER_ADAPTERS = 'mann-filter';
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          ADMIN_EMAIL,
          ADMIN_PASSWORD,
        );
      });

      afterAll(() => {
        process.env.SUPPLIER_ADAPTERS = previous;
      });

      it('starts a crawl from the admin and reports its progress', async () => {
        const before = await api.get('/admin/crawls', adminHeaders);
        expect(before.data.crawls).toEqual([
          {
            key: 'mann-filter',
            supplier: 'MANN-FILTER',
            status: 'idle',
            paused_reason: null,
            started_at: null,
            finished_at: null,
            pages: { queued: 0, done: 0, failed: 0, gone: 0 },
          },
        ]);

        await api.post('/admin/crawls/mann-filter', {}, adminHeaders);

        const after = await api.get('/admin/crawls', adminHeaders);
        expect(after.data.crawls[0]).toMatchObject({
          status: 'running',
          started_at: expect.any(String),
        });
      });

      it('refuses a site no crawler reads', async () => {
        const response = await api
          .post('/admin/crawls/nowhere', {}, adminHeaders)
          .catch((error: { response: { status: number } }) => error.response);
        expect(response.status).toBe(404);
      });
    });
  },
});
