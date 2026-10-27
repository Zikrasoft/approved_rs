import { gunzipSync, gzipSync } from 'node:zlib';

import robotsParser from 'robots-parser';

import type { Fetched, Fetcher, FetchMode } from './fetcher';
import type { CrawledSite } from './site';
import { sitemapLinks } from './sitemap';
import type {
  ClaimedPage,
  CrawlRun,
  CrawlStore,
  FailureReason,
  PauseReason,
} from './store';

const ROBOTS_AGENT = 'CarLabCatalogBot';
const ROBOTS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LEASE_MS = 10 * 60 * 1000;
const IDLE_MS = 1000;
const MAX_ATTEMPTS = 5;
const MAX_SERVER_ERRORS = 5;
const MAX_BLOCKED_PAGES = 5;
const MAX_GAP_MS = 60 * 1000;

export type Clock = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

export type CrawlDeps = {
  store: CrawlStore;
  openFetcher: (mode: FetchMode) => Fetcher;
  clock: Clock;
  from?: string;
  random?: () => number;
};

type Robots = ReturnType<typeof robotsParser>;
type Response = Extract<Fetched, { kind: 'response' }>;

const retryAfterMs = (
  value: string | undefined,
  now: number,
): number | null => {
  if (!value) return null;
  if (/^\d+$/u.test(value.trim())) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
};

const succeeded = ({ status }: Response) => status >= 200 && status < 300;

const xmlOf = (bytes: Buffer) =>
  bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;

export async function crawlSite(
  site: CrawledSite,
  { store, openFetcher, clock, from, random = Math.random }: CrawlDeps,
): Promise<void> {
  const http = openFetcher('http');
  const pages =
    (site.fetchMode ?? 'http') === 'http' ? http : openFetcher('browser');
  try {
    await crawlWith(site, { store, clock, from, random, http, pages });
  } finally {
    await Promise.all([...new Set([http, pages])].map((one) => one.close()));
  }
}

async function crawlWith(
  site: CrawledSite,
  {
    store,
    clock,
    from,
    random,
    http,
    pages: pageFetcher,
  }: Omit<CrawlDeps, 'openFetcher'> & {
    random: () => number;
    http: Fetcher;
    pages: Fetcher;
  },
): Promise<void> {
  let robots: Robots | null = null;
  let robotsAt = -Infinity;
  let gapMs = site.floorMs;
  let lastRequestAt = -Infinity;
  let holdUntil = -Infinity;
  let serverErrors = 0;
  let blockedPages = 0;
  const sampleSeed = String(random());
  const at = () => new Date(clock.now());

  const request = async (
    fetcher: Fetcher,
    url: string,
    headers: Record<string, string> = {},
    browser: Pick<CrawledSite, 'waitFor' | 'interact'> = {},
  ): Promise<Fetched> => {
    const hold = holdUntil - clock.now();
    if (hold > 0) await clock.sleep(hold);
    return fetcher.fetch({
      url,
      headers: { ...(from && { from }), ...headers },
      ...browser,
      beforeAttempt: async () => {
        const wait = lastRequestAt + gapMs - clock.now();
        if (wait > 0) await clock.sleep(wait);
        lastRequestAt = clock.now();
      },
    });
  };

  const allowed = (url: string) =>
    robots?.isAllowed(url, ROBOTS_AGENT) ?? false;

  const freshRobots = async (): Promise<PauseReason | null> => {
    if (robots && clock.now() - robotsAt < ROBOTS_MAX_AGE_MS) return null;
    const url = new URL('/robots.txt', site.origin).href;
    const fetched = await request(http, url);
    if (fetched.kind === 'blocked') return 'blocked';
    if (
      fetched.kind === 'error' ||
      fetched.status === 429 ||
      fetched.status >= 500
    ) {
      return 'robots_unavailable';
    }
    robots = robotsParser(
      url,
      succeeded(fetched) ? fetched.body.toString('utf8') : '',
    );
    robotsAt = clock.now();
    const delayMs = (robots.getCrawlDelay(ROBOTS_AGENT) ?? 0) * 1000;
    gapMs = Math.max(gapMs, delayMs);
    return null;
  };

  const sitemapPages = async (
    url: string,
    found: string[],
  ): Promise<PauseReason | null> => {
    const stale = await freshRobots();
    if (stale) return stale;
    if (!allowed(url)) return null;
    const fetched = await request(http, url);
    if (fetched.kind === 'blocked') return 'blocked';
    if (fetched.kind === 'error' || !succeeded(fetched)) {
      return 'sitemap_unavailable';
    }
    const links = sitemapLinks(xmlOf(fetched.body), site.sitemapPage);
    found.push(...links.pages);
    for (const child of links.sitemaps) {
      const reason = await sitemapPages(child, found);
      if (reason) return reason;
    }
    return null;
  };

  const seed = async (): Promise<PauseReason | null> => {
    const found: string[] = [];
    for (const sitemap of site.sitemaps) {
      const reason = await sitemapPages(sitemap, found);
      if (reason) return reason;
    }
    await store.seed(site.name, [...new Set(found.filter(site.isPage))], at());
    return null;
  };

  const fail = async (
    page: ClaimedPage,
    error: FailureReason,
    http_status: number | null = null,
  ) => {
    await store.update(site.name, page.url, {
      status: 'failed',
      error,
      http_status,
    });
  };

  const backOff = async (
    page: ClaimedPage,
    response: Response | null,
  ): Promise<PauseReason | null> => {
    if (!response || response.status >= 500) serverErrors += 1;
    const waitMs =
      retryAfterMs(response?.headers['retry-after'], clock.now()) ??
      site.floorMs * 2 ** page.attempts * (1 + random());
    gapMs = Math.max(gapMs, Math.min(gapMs * 2, MAX_GAP_MS));
    holdUntil = Math.max(holdUntil, clock.now() + waitMs);
    const attempts = page.attempts + 1;
    const gaveUp = attempts >= MAX_ATTEMPTS;
    await store.update(site.name, page.url, {
      status: gaveUp ? 'failed' : 'queued',
      attempts,
      next_attempt_at: new Date(clock.now() + waitMs),
      http_status: response?.status ?? null,
      error: gaveUp ? (response ? 'server' : 'network') : null,
    });
    return serverErrors >= MAX_SERVER_ERRORS ? 'server_errors' : null;
  };

  const fetchPage = async (
    page: ClaimedPage,
  ): Promise<PauseReason | 'idle' | null> => {
    if (!allowed(page.url)) {
      await fail(page, 'robots');
      return null;
    }
    const fetched = await request(
      pageFetcher,
      page.url,
      {
        ...(page.etag && { 'if-none-match': page.etag }),
        ...(page.last_modified && { 'if-modified-since': page.last_modified }),
      },
      { waitFor: site.waitFor, interact: site.interact },
    );
    if (fetched.kind === 'blocked') {
      blockedPages += 1;
      await fail(page, 'blocked');
      return blockedPages >= MAX_BLOCKED_PAGES ? 'blocked' : null;
    }
    blockedPages = 0;
    if (fetched.kind === 'error') return backOff(page, null);
    const { status } = fetched;
    if (status === 429 || status >= 500) return backOff(page, fetched);
    serverErrors = 0;
    const settled = { http_status: status, fetched_at: at(), error: null };
    if (status === 304) {
      await store.update(site.name, page.url, { status: 'done', ...settled });
    } else if (succeeded(fetched)) {
      await store.update(site.name, page.url, {
        status: 'done',
        ...settled,
        body: gzipSync(fetched.body),
        etag: fetched.headers.etag ?? null,
        last_modified: fetched.headers['last-modified'] ?? null,
      });
      if (await store.countStored(site.name)) return 'idle';
    } else if (status === 404 || status === 410) {
      await store.update(site.name, page.url, { status: 'gone', ...settled });
    } else {
      await fail(page, 'http', status);
    }
    return null;
  };

  const step = async ({
    seeded,
    pages_left,
  }: CrawlRun): Promise<PauseReason | 'idle' | null> => {
    const stale = await freshRobots();
    if (stale) return stale;
    if (!seeded) return seed();
    const page = await store.claim(
      site.name,
      at(),
      new Date(clock.now() + LEASE_MS),
      pages_left === null ? null : sampleSeed,
    );
    if (page) return fetchPage(page);
    const due = await store.nextDue(site.name);
    if (!due) return 'idle';
    await clock.sleep(Math.max(due.getTime() - clock.now(), IDLE_MS));
    return null;
  };

  for (;;) {
    const run = await store.run(site.name);
    if (run?.status !== 'running') return;
    const outcome = await step(run);
    if (outcome === 'idle') {
      await store.finish(site.name, at());
      return;
    }
    if (outcome) {
      await store.pause(site.name, outcome);
      return;
    }
  }
}
