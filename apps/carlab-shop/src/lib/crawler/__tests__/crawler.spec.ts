import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../integration-tests/adminAuth';
import { memoryBucket } from '../../../../integration-tests/fakeStorage';
import { crawledSupplierAdapter } from '../adapter';
import { crawlSite } from '../crawl';
import type { Fetched, Fetcher, FetchMode } from '../fetcher';
import type { CrawledSite } from '../site';
import { mannFilter } from '../sites/mann-filter';
import { crawlStore, type CrawlStore } from '../store';

type Responder = () => Fetched;

const START = Date.parse('2026-10-25T00:00:00Z');
const HOUR = 60 * 60 * 1000;
const BLOCKED_ATTEMPTS = 4;

const ok =
  (body: string, headers: Record<string, string> = {}): Responder =>
  () => ({ kind: 'response', status: 200, headers, body: Buffer.from(body) });
const status =
  (code: number, headers: Record<string, string> = {}): Responder =>
  () => ({ kind: 'response', status: code, headers, body: Buffer.alloc(0) });
const blocked: Responder = () => ({
  kind: 'blocked',
  reason: 'Request blocked - received 403 status code.',
});
const unreachable: Responder = () => ({ kind: 'error', reason: 'ECONNRESET' });

const fakeWeb = (routes: Record<string, Responder | Responder[]>) => {
  const requests: {
    url: string;
    at: number;
    headers: Record<string, string>;
    mode: FetchMode;
    waitFor?: string;
  }[] = [];
  const closed: FetchMode[] = [];
  const served = new Map<string, number>();
  const clock = {
    time: START,
    now: () => clock.time,
    sleep: async (ms: number) => {
      clock.time += ms;
    },
  };
  const responder = (url: string): Responder => {
    const route = routes[url];
    if (!route) return status(404);
    if (!Array.isArray(route)) return route;
    const index = served.get(url) ?? 0;
    served.set(url, index + 1);
    return route[Math.min(index, route.length - 1)];
  };
  const openFetcher = (mode: FetchMode): Fetcher => ({
    fetch: async ({ url, headers = {}, waitFor, beforeAttempt }) => {
      const answer = responder(url);
      const attempts = answer().kind === 'blocked' ? BLOCKED_ATTEMPTS : 1;
      for (let attempt = 0; attempt < attempts; attempt++) {
        await beforeAttempt();
        requests.push({ url, at: clock.time, headers, mode, waitFor });
      }
      return answer();
    },
    close: async () => {
      closed.push(mode);
    },
  });
  const fetched = (url: string) =>
    requests.filter((request) => request.url === url);
  return { requests, closed, clock, openFetcher, fetched };
};

const urlset = (...urls: string[]) =>
  `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
    .map((url) => `<url><loc>${url}</loc></url>`)
    .join('')}</urlset>`;

const testSite = (
  name: string,
  floorMs = 2000,
  fetchMode?: FetchMode,
): CrawledSite => ({
  key: 'mann-filter',
  name,
  origin: `https://${name}.test`,
  sitemaps: [`https://${name}.test/sitemap.xml`],
  floorMs,
  ...(fetchMode && { fetchMode }),
  isPage: (url) => url.includes('/p/'),
  parse: () => null,
});

const NO_FAILURES = {
  blocked: 0,
  robots: 0,
  network: 0,
  server: 0,
  http: 0,
};

const ADMIN_EMAIL = 'admin@crawler-tests.local';
const ADMIN_PASSWORD = 'supersecret';

medusaIntegrationTestRunner({
  moduleName: 'crawler',
  testSuite: ({ api, getContainer }) => {
    let store: CrawlStore;
    const pageBucket = memoryBucket();

    beforeAll(() => {
      store = crawlStore(
        getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION),
        pageBucket.bucket,
      );
    });

    const crawl = async (
      site: CrawledSite,
      web: ReturnType<typeof fakeWeb>,
      limit: number | null = null,
      random = () => 0,
    ) => {
      await store.start(site.name, new Date(web.clock.now()), limit);
      await store.next([site.name], new Date(web.clock.now()));
      await crawlSite(site, {
        store,
        openFetcher: web.openFetcher,
        clock: web.clock,
        from: 'crawler@carlab.test',
        random,
      });
      const [progress] = await store.progress([site.name]);
      return progress;
    };

    describe('crawlSite', () => {
      it('reads robots.txt first and keeps the Crawl-delay between requests', async () => {
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
          expect(headers.from).toBe('crawler@carlab.test');
        }
        expect(progress.run?.status).toBe('done');
        expect(progress.pages).toEqual({
          queued: 0,
          done: 2,
          failed: 0,
          gone: 0,
        });
        expect(progress.failures).toEqual(NO_FAILURES);
        const [snapshot] = await store.snapshots(site.name, null, 1);
        expect(gunzipSync(snapshot.body!).toString('utf8')).toBe(
          '<html>one</html>',
        );
        expect(web.closed).toEqual(['http']);
      });

      it('keeps the raw page in the private bucket and only its key in Postgres', async () => {
        const site = testSite('bucketed');
        const web = fakeWeb({
          'https://bucketed.test/robots.txt': ok('User-agent: *\n'),
          'https://bucketed.test/sitemap.xml': ok(
            urlset('https://bucketed.test/p/1'),
          ),
          'https://bucketed.test/p/1': ok('<html>kept</html>'),
        });

        await crawl(site, web);

        const row = await getContainer()
          .resolve(ContainerRegistrationKeys.PG_CONNECTION)('crawl_page')
          .where({ site: site.name, url: 'https://bucketed.test/p/1' })
          .first('body', 'body_key');
        expect(row.body).toBeNull();
        const stored = pageBucket.objects.get(row.body_key);
        expect(gunzipSync(stored!.body).toString('utf8')).toBe(
          '<html>kept</html>',
        );
        const [snapshot] = await store.snapshots(site.name, null, 1);
        expect(gunzipSync(snapshot.body!).toString('utf8')).toBe(
          '<html>kept</html>',
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
        expect(progress.failures).toEqual({ ...NO_FAILURES, robots: 1 });
      });

      it('marks a page the site keeps blocking failed and crawls on, keeping the gap between every retry', async () => {
        const site = testSite('blocking');
        const page = (n: number) => `https://blocking.test/p/${n}`;
        const web = fakeWeb({
          'https://blocking.test/robots.txt': ok(''),
          'https://blocking.test/sitemap.xml': ok(urlset(page(1), page(2))),
          [page(1)]: blocked,
          [page(2)]: ok('two'),
        });

        const progress = await crawl(site, web);

        const attempts = web.fetched(page(1)).map(({ at }) => at - START);
        expect(attempts).toEqual([4000, 6000, 8000, 10000]);
        expect(web.fetched(page(2))[0].at - START).toBe(12000);
        expect(progress.run?.status).toBe('done');
        expect(progress.pages).toMatchObject({ done: 1, failed: 1 });
        expect(progress.failures).toEqual({ ...NO_FAILURES, blocked: 1 });
      });

      it('pauses once five pages in a row stay blocked and resumes where it stopped', async () => {
        const site = testSite('walled');
        const pages = [1, 2, 3, 4, 5, 6, 7].map(
          (n) => `https://walled.test/p/${n}`,
        );
        const web = fakeWeb({
          'https://walled.test/robots.txt': ok(''),
          'https://walled.test/sitemap.xml': ok(urlset(...pages)),
          ...Object.fromEntries(pages.slice(0, 5).map((url) => [url, blocked])),
          [pages[5]]: ok('six'),
          [pages[6]]: ok('seven'),
        });

        const paused = await crawl(site, web);

        expect(paused.run).toMatchObject({
          status: 'paused',
          paused_reason: 'blocked',
        });
        expect(web.fetched(pages[5])).toEqual([]);
        expect(paused.failures).toEqual({ ...NO_FAILURES, blocked: 5 });

        const resumed = await crawl(site, web);

        expect(resumed.run?.status).toBe('done');
        expect(web.fetched('https://walled.test/sitemap.xml')).toHaveLength(1);
        expect(resumed.pages).toMatchObject({ done: 2, failed: 5, queued: 0 });
      });

      it('pauses when the site blocks its robots.txt', async () => {
        const site = testSite('closed');
        const web = fakeWeb({ 'https://closed.test/robots.txt': blocked });

        const progress = await crawl(site, web);

        expect(progress.run).toMatchObject({
          status: 'paused',
          paused_reason: 'blocked',
        });
      });

      it('fetches pages of a browser site through the browser, waiting for its selector, and robots.txt and sitemaps over http', async () => {
        const site = {
          ...testSite('cloudy', 2000, 'browser'),
          waitFor: '#criteria',
        };
        const web = fakeWeb({
          'https://cloudy.test/robots.txt': ok(''),
          'https://cloudy.test/sitemap.xml': ok(
            urlset('https://cloudy.test/p/1'),
          ),
          'https://cloudy.test/p/1': ok('one'),
        });

        const progress = await crawl(site, web);

        expect(
          web.requests.map(({ mode, waitFor }) => [mode, waitFor]),
        ).toEqual([
          ['http', undefined],
          ['http', undefined],
          ['browser', '#criteria'],
        ]);
        expect(progress.pages).toMatchObject({ done: 1 });
        expect([...web.closed].sort()).toEqual(['browser', 'http']);
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
              status(503, {
                'retry-after': new Date(web.clock.now() + HOUR).toUTCString(),
              })(),
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

      it('gives up on a page that stays unreachable or refused and says why', async () => {
        const site = testSite('flaky');
        const page = (n: number) => `https://flaky.test/p/${n}`;
        const web = fakeWeb({
          'https://flaky.test/robots.txt': ok(''),
          'https://flaky.test/sitemap.xml': ok(
            urlset(page(1), page(2), page(3)),
          ),
          [page(1)]: unreachable,
          [page(2)]: ok('two'),
          [page(3)]: status(400),
        });

        const progress = await crawl(site, web);

        expect(web.fetched(page(1))).toHaveLength(5);
        expect(progress.run?.status).toBe('done');
        expect(progress.pages).toMatchObject({ done: 1, failed: 2 });
        expect(progress.failures).toEqual({
          ...NO_FAILURES,
          network: 1,
          http: 1,
        });
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

      it("takes a sitemap's pages from the site's own reader when it has one", async () => {
        const site: CrawledSite = {
          ...testSite('picky'),
          sitemapPage: ({ loc }) => loc.includes('keep'),
        };
        const web = fakeWeb({
          'https://picky.test/robots.txt': ok(''),
          'https://picky.test/sitemap.xml': ok(
            urlset(
              'https://picky.test/p/keep-1',
              'https://picky.test/p/skip-2',
              'https://picky.test/other/keep-3',
            ),
          ),
        });

        await crawl(site, web);

        expect(web.requests.map(({ url }) => url).slice(2)).toEqual([
          'https://picky.test/p/keep-1',
        ]);
      });

      it('ends a test run once it has stored the pages it was asked for', async () => {
        const site = testSite('sample');
        const pages = [1, 2, 3, 4].map((n) => `https://sample.test/p/${n}`);
        const web = fakeWeb({
          'https://sample.test/robots.txt': ok(''),
          'https://sample.test/sitemap.xml': ok(urlset(...pages)),
          [pages[0]]: status(404),
          ...Object.fromEntries(pages.slice(1).map((url) => [url, ok('page')])),
        });

        const sample = await crawl(site, web, 2);

        expect(sample.run?.status).toBe('done');
        expect(sample.pages).toMatchObject({ done: 2, gone: 1, queued: 1 });

        const full = await crawl(site, web);

        expect(full.pages).toMatchObject({ done: 3, gone: 1, queued: 0 });
      });

      it('samples a test run from across the whole sitemap rather than its first pages', async () => {
        const sampled = async (name: string, random: () => number) => {
          const site = testSite(name);
          const pages = Array.from(
            { length: 40 },
            (_, n) => `https://${name}.test/p/${String(n).padStart(2, '0')}`,
          );
          const web = fakeWeb({
            [`https://${name}.test/robots.txt`]: ok(''),
            [`https://${name}.test/sitemap.xml`]: ok(urlset(...pages)),
            ...Object.fromEntries(pages.map((url) => [url, ok('page')])),
          });
          await crawl(site, web, 4, random);
          return web.requests
            .slice(2)
            .map(({ url }) => pages.indexOf(url))
            .sort((a, b) => a - b);
        };

        const sample = await sampled('spread', () => 0.25);
        const another = await sampled('spread-again', () => 0.75);

        expect(sample).toHaveLength(4);
        expect(sample).not.toEqual([0, 1, 2, 3]);
        expect(Math.max(...sample)).toBeGreaterThanOrEqual(10);
        expect(another).toHaveLength(4);
        expect(another).not.toEqual(sample);
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

    describe('one crawl at a time', () => {
      it('queues a crawl started while another runs and starts it once the running one is done', async () => {
        const first = testSite('first');
        const second = testSite('second');
        const sites = [first.name, second.name];
        const web = fakeWeb({
          'https://first.test/robots.txt': ok(''),
          'https://first.test/sitemap.xml': ok(
            urlset('https://first.test/p/1'),
          ),
          'https://first.test/p/1': ok('one'),
        });
        await store.start(first.name, new Date(START));
        await store.start(second.name, new Date(START + 1000));

        expect(await store.next(sites, new Date(START))).toBe(first.name);
        expect(await store.next(sites, new Date(START))).toBe(first.name);
        expect((await store.run(second.name))?.status).toBe('queued');

        await crawlSite(first, {
          store,
          openFetcher: web.openFetcher,
          clock: web.clock,
        });

        expect((await store.run(first.name))?.status).toBe('done');
        expect(await store.next(sites, new Date(START + HOUR))).toBe(
          second.name,
        );
        expect(await store.run(second.name)).toMatchObject({
          status: 'running',
          started_at: new Date(START + HOUR),
        });
        expect(await store.next(sites, new Date(START + HOUR))).toBe(
          second.name,
        );
      });

      it('starts the next queued crawl once staff pause the running one, and queues the paused one again behind it', async () => {
        const sites = ['ahead', 'behind'];
        await store.start('ahead', new Date(START));
        await store.start('behind', new Date(START + 1000));
        await store.next(sites, new Date(START));

        await store.pause('ahead', 'staff');

        expect(await store.next(sites, new Date(START + HOUR))).toBe('behind');
        await store.start('ahead', new Date(START + 2 * HOUR));
        expect((await store.run('ahead'))?.status).toBe('queued');
        expect(await store.next(sites, new Date(START + 3 * HOUR))).toBe(
          'behind',
        );
      });

      it('finds nothing to crawl when nothing is queued', async () => {
        expect(await store.next(['nothing'], new Date(START))).toBe(null);
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
        expect(last).toEqual({ articles: [], next: null, unreadable: [] });
        expect(await adapter.quote(['HU816X_MANN-FILTER'])).toEqual([]);
      });

      it('reads the other pages on when one page throws or reads into an invalid article, and names the unreadable ones', async () => {
        const site: CrawledSite = {
          ...testSite('brittle'),
          parse: (html) => {
            if (html === 'throws') throw new Error('Unexpected markup');
            return {
              article_id: html,
              brand: 'BRITTLE',
              number: html,
              name: html === 'invalid' ? '' : `Part ${html}`,
              category: 'parts',
            };
          },
        };
        const pages = {
          'https://brittle.test/p/1': 'one',
          'https://brittle.test/p/2': 'throws',
          'https://brittle.test/p/3': 'invalid',
          'https://brittle.test/p/4': 'four',
        };
        await store.start(site.name, new Date(START));
        await store.seed(site.name, Object.keys(pages), new Date(START));
        for (const [url, body] of Object.entries(pages)) {
          await store.update(site.name, url, {
            status: 'done',
            body: gzipSync(body),
          });
        }

        const page = await crawledSupplierAdapter(site, store).listCatalogue(
          null,
        );

        expect(page.articles.map(({ number }) => number)).toEqual([
          'one',
          'four',
        ]);
        expect(page.unreadable).toEqual([
          {
            url: 'https://brittle.test/p/2',
            reason: 'Unexpected markup',
          },
          { url: 'https://brittle.test/p/3', reason: expect.any(String) },
        ]);
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
            failures: NO_FAILURES,
          },
        ]);

        await api.post('/admin/crawls/mann-filter', {}, adminHeaders);

        const after = await api.get('/admin/crawls', adminHeaders);
        expect(after.data.crawls[0]).toMatchObject({ status: 'queued' });
      });

      it('says the local crawler is not running while a crawl waits and no worker was seen in the last minute', async () => {
        const idle = await api.get('/admin/crawls', adminHeaders);
        expect(idle.data.worker_missing).toBe(false);

        await api.post('/admin/crawls/mann-filter', {}, adminHeaders);
        const unseen = await api.get('/admin/crawls', adminHeaders);
        expect(unseen.data.worker_missing).toBe(true);

        await store.beat(['MANN-FILTER'], new Date(Date.now() - 2 * 60_000));
        const stale = await api.get('/admin/crawls', adminHeaders);
        expect(stale.data.worker_missing).toBe(true);

        await store.beat(['MANN-FILTER'], new Date());
        const seen = await api.get('/admin/crawls', adminHeaders);
        expect(seen.data.worker_missing).toBe(false);
      });

      it('lets staff pause a crawl from the admin', async () => {
        await api.post('/admin/crawls/mann-filter', {}, adminHeaders);

        const paused = await api.post(
          '/admin/crawls/mann-filter/pause',
          {},
          adminHeaders,
        );

        expect(paused.data).toEqual({ paused: 'mann-filter' });
        const after = await api.get('/admin/crawls', adminHeaders);
        expect(after.data.crawls[0]).toMatchObject({
          status: 'paused',
          paused_reason: 'staff',
        });
        const missing = await api
          .post('/admin/crawls/nowhere/pause', {}, adminHeaders)
          .catch((error: { response: { status: number } }) => error.response);
        expect(missing.status).toBe(404);
      });

      it('takes a page limit for a test run and refuses one that is not a positive whole number', async () => {
        const started = await api.post(
          '/admin/crawls/mann-filter',
          { limit: 10 },
          adminHeaders,
        );
        expect(started.data).toEqual({ started: 'mann-filter' });
        expect((await store.run('MANN-FILTER'))?.pages_left).toBe(10);

        for (const limit of [0, 2.5, '10']) {
          const refused = await api
            .post('/admin/crawls/mann-filter', { limit }, adminHeaders)
            .catch((error: { response: { status: number } }) => error.response);
          expect(refused.status).toBe(400);
        }
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
