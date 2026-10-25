import { gunzipSync, gzipSync } from 'node:zlib';

import robotsParser from 'robots-parser';

import type { CrawledSite } from './site';
import { sitemapLinks } from './sitemap';
import type { ClaimedPage, CrawlStore, PauseReason } from './store';

export const CRAWLER_USER_AGENT =
  'CarLabCatalogBot/1.0 (+https://carlab.rs/en/contact/)';

const ROBOTS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LEASE_MS = 10 * 60 * 1000;
const IDLE_MS = 1000;
const MAX_ATTEMPTS = 5;
const MAX_SERVER_ERRORS = 5;
const MAX_GAP_MS = 60 * 1000;
const CHALLENGE_TITLE =
  /<title>\s*(?:just a moment\.\.\.|attention required! \| cloudflare)/iu;

export type Clock = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

export type CrawlDeps = {
  store: CrawlStore;
  fetch: typeof fetch;
  clock: Clock;
  from?: string;
  random?: () => number;
};

type Robots = ReturnType<typeof robotsParser>;

const retryAfterMs = (value: string | null, now: number): number | null => {
  if (!value) return null;
  if (/^\d+$/u.test(value.trim())) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
};

const pushback = (response: Response, body: string): PauseReason | null => {
  if (response.headers.get('cf-mitigated') === 'challenge') return 'challenge';
  if (CHALLENGE_TITLE.test(body)) return 'challenge';
  return response.status === 403 ? 'forbidden' : null;
};

const xmlOf = (bytes: Buffer) =>
  (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString(
    'utf8',
  );

export async function crawlSite(
  site: CrawledSite,
  { store, fetch, clock, from, random = Math.random }: CrawlDeps,
): Promise<void> {
  let robots: Robots | null = null;
  let robotsAt = -Infinity;
  let gapMs = site.floorMs;
  let lastRequestAt = -Infinity;
  let holdUntil = -Infinity;
  let serverErrors = 0;
  const at = () => new Date(clock.now());

  const request = async (
    url: string,
    headers: Record<string, string> = {},
  ): Promise<Response | null> => {
    const wait = Math.max(lastRequestAt + gapMs, holdUntil) - clock.now();
    if (wait > 0) await clock.sleep(wait);
    lastRequestAt = clock.now();
    return fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': CRAWLER_USER_AGENT,
        ...(from && { from }),
        ...headers,
      },
    }).catch(() => null);
  };

  const allowed = (url: string) =>
    robots?.isAllowed(url, CRAWLER_USER_AGENT) ?? false;

  const freshRobots = async (): Promise<PauseReason | null> => {
    if (robots && clock.now() - robotsAt < ROBOTS_MAX_AGE_MS) return null;
    const url = new URL('/robots.txt', site.origin).href;
    const response = await request(url);
    if (!response || response.status === 429 || response.status >= 500) {
      return 'robots_unavailable';
    }
    const text = await response.text();
    const refused = pushback(response, text);
    if (refused) return refused;
    robots = robotsParser(url, response.ok ? text : '');
    robotsAt = clock.now();
    const delayMs = (robots.getCrawlDelay(CRAWLER_USER_AGENT) ?? 0) * 1000;
    gapMs = Math.max(gapMs, delayMs);
    return null;
  };

  const sitemapPages = async (
    url: string,
    pages: string[],
  ): Promise<PauseReason | null> => {
    const stale = await freshRobots();
    if (stale) return stale;
    if (!allowed(url)) return null;
    const response = await request(url);
    if (!response) return 'sitemap_unavailable';
    const bytes = Buffer.from(await response.arrayBuffer());
    const refused = pushback(response, bytes.toString('utf8'));
    if (refused) return refused;
    if (!response.ok) return 'sitemap_unavailable';
    const links = sitemapLinks(xmlOf(bytes));
    pages.push(...links.pages);
    for (const child of links.sitemaps) {
      const reason = await sitemapPages(child, pages);
      if (reason) return reason;
    }
    return null;
  };

  const seed = async (): Promise<PauseReason | null> => {
    const pages: string[] = [];
    for (const sitemap of site.sitemaps) {
      const reason = await sitemapPages(sitemap, pages);
      if (reason) return reason;
    }
    await store.seed(site.name, [...new Set(pages.filter(site.isPage))], at());
    return null;
  };

  const backOff = async (
    page: ClaimedPage,
    response: Response | null,
  ): Promise<PauseReason | null> => {
    if (!response || response.status >= 500) serverErrors += 1;
    const waitMs =
      retryAfterMs(response?.headers.get('retry-after') ?? null, clock.now()) ??
      site.floorMs * 2 ** page.attempts * (1 + random());
    gapMs = Math.max(gapMs, Math.min(gapMs * 2, MAX_GAP_MS));
    holdUntil = Math.max(holdUntil, clock.now() + waitMs);
    const attempts = page.attempts + 1;
    await store.update(site.name, page.url, {
      status: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued',
      attempts,
      next_attempt_at: new Date(clock.now() + waitMs),
      http_status: response?.status ?? null,
      error: response ? null : 'network',
    });
    return serverErrors >= MAX_SERVER_ERRORS ? 'server_errors' : null;
  };

  const fetchPage = async (page: ClaimedPage): Promise<PauseReason | null> => {
    if (!allowed(page.url)) {
      await store.update(site.name, page.url, {
        status: 'failed',
        error: 'robots',
      });
      return null;
    }
    const response = await request(page.url, {
      ...(page.etag && { 'if-none-match': page.etag }),
      ...(page.last_modified && { 'if-modified-since': page.last_modified }),
    });
    if (!response) return backOff(page, null);
    const body = await response.text();
    const refused = pushback(response, body);
    if (refused) {
      await store.update(site.name, page.url, { next_attempt_at: at() });
      return refused;
    }
    const { status } = response;
    if (status === 429 || status >= 500) return backOff(page, response);
    serverErrors = 0;
    const settled = { http_status: status, fetched_at: at(), error: null };
    if (status === 304) {
      await store.update(site.name, page.url, { status: 'done', ...settled });
    } else if (response.ok) {
      await store.update(site.name, page.url, {
        status: 'done',
        ...settled,
        body: gzipSync(body),
        etag: response.headers.get('etag'),
        last_modified: response.headers.get('last-modified'),
      });
    } else {
      await store.update(site.name, page.url, {
        status: status === 404 || status === 410 ? 'gone' : 'failed',
        ...settled,
      });
    }
    return null;
  };

  const step = async (
    seeded: boolean,
  ): Promise<PauseReason | 'idle' | null> => {
    const stale = await freshRobots();
    if (stale) return stale;
    if (!seeded) return seed();
    const page = await store.claim(
      site.name,
      at(),
      new Date(clock.now() + LEASE_MS),
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
    const outcome = await step(run.seeded);
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
