import { createHash } from 'node:crypto';

import type { Knex } from '@medusajs/framework/mikro-orm/knex';

import type { Bucket } from '../storage';

export const PAUSE_REASONS = [
  'robots_unavailable',
  'sitemap_unavailable',
  'blocked',
  'server_errors',
  'staff',
] as const;

export type PauseReason = (typeof PAUSE_REASONS)[number];

export const CRAWL_RUN_STATUSES = [
  'queued',
  'running',
  'paused',
  'done',
] as const;

export const PAGE_STATUSES = ['queued', 'done', 'failed', 'gone'] as const;

type PageStatus = (typeof PAGE_STATUSES)[number];

export const FAILURE_REASONS = [
  'blocked',
  'robots',
  'network',
  'server',
  'http',
] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];

export type CrawlRun = {
  site: string;
  status: (typeof CRAWL_RUN_STATUSES)[number];
  paused_reason: PauseReason | null;
  seeded: boolean;
  pages_left: number | null;
  queued_at: Date | null;
  started_at: Date;
  finished_at: Date | null;
};

export type ClaimedPage = {
  url: string;
  attempts: number;
  etag: string | null;
  last_modified: string | null;
};

export type PageUpdate = Partial<{
  status: PageStatus;
  attempts: number;
  next_attempt_at: Date;
  http_status: number | null;
  error: FailureReason | null;
  etag: string | null;
  last_modified: string | null;
  fetched_at: Date;
  body: Buffer;
}>;

export type CrawlProgress = {
  site: string;
  run: CrawlRun | null;
  pages: Record<PageStatus, number>;
  failures: Record<FailureReason, number>;
};

const SEED_BATCH = 1000;

const tally = <Key extends string>(
  keys: readonly Key[],
  countOf: (key: Key) => string | undefined,
) =>
  Object.fromEntries(
    keys.map((key) => [key, Number(countOf(key) ?? 0)]),
  ) as Record<Key, number>;

const pageKey = (site: string, url: string) =>
  `crawl/${encodeURIComponent(site)}/${createHash('sha256').update(url).digest('hex')}.html.gz`;

const pagesBucket = (pages: Bucket | null): Bucket => {
  if (!pages) throw new Error('Crawled pages need the S3 storage (S3_* env)');
  return pages;
};

export const crawlStore = (pg: Knex, pages: Bucket | null = null) => ({
  async run(site: string): Promise<CrawlRun | null> {
    return (await pg('crawl_run').where({ site }).first()) ?? null;
  },

  async next(sites: string[], now: Date): Promise<string | null> {
    const running = await pg('crawl_run')
      .whereIn('site', sites)
      .andWhere({ status: 'running' })
      .orderBy('started_at')
      .first('site');
    if (running) return running.site;
    const { rows } = await pg.raw(
      `update crawl_run set
         status = 'running',
         started_at = case when seeded then started_at else ? end
       where site = (
         select site from crawl_run
         where site = any(?) and status = 'queued'
         order by queued_at, site
         limit 1
       )
       returning site`,
      [now, sites],
    );
    return rows[0]?.site ?? null;
  },

  async start(
    site: string,
    now: Date,
    limit: number | null = null,
  ): Promise<void> {
    await pg.raw(
      `insert into crawl_run (site, status, seeded, pages_left, queued_at, started_at)
       values (?, 'queued', false, ?, ?, ?)
       on conflict (site) do update set
         status = case when crawl_run.status = 'running' then 'running' else 'queued' end,
         paused_reason = null,
         pages_left = excluded.pages_left,
         finished_at = null,
         seeded = crawl_run.seeded and crawl_run.status in ('paused', 'queued'),
         queued_at = case when crawl_run.status in ('running', 'queued') then crawl_run.queued_at else excluded.queued_at end`,
      [site, limit, now, now],
    );
  },

  async countStored(site: string): Promise<boolean> {
    const { rows } = await pg.raw(
      `update crawl_run set pages_left = pages_left - 1
       where site = ? and pages_left is not null
       returning pages_left`,
      [site],
    );
    return rows[0]?.pages_left === 0;
  },

  async seed(site: string, urls: string[], now: Date): Promise<void> {
    await pg.transaction(async (trx) => {
      for (let start = 0; start < urls.length; start += SEED_BATCH) {
        await trx('crawl_page')
          .insert(
            urls
              .slice(start, start + SEED_BATCH)
              .map((url) => ({ site, url, next_attempt_at: now })),
          )
          .onConflict(['site', 'url'])
          .merge({
            status: 'queued',
            attempts: 0,
            next_attempt_at: now,
            error: null,
          });
      }
      await trx('crawl_run').where({ site }).update({ seeded: true });
    });
  },

  async claim(
    site: string,
    now: Date,
    leaseUntil: Date,
    sampleSeed: string | null = null,
  ): Promise<ClaimedPage | null> {
    const order =
      sampleSeed === null ? 'next_attempt_at, url' : 'md5(url || ?), url';
    const { rows } = await pg.raw(
      `update crawl_page set next_attempt_at = ?
       where (site, url) = (
         select site, url from crawl_page
         where site = ? and status = 'queued' and next_attempt_at <= ?
         order by ${order}
         limit 1
         for update skip locked
       )
       returning url, attempts, etag, last_modified`,
      [leaseUntil, site, now, ...(sampleSeed === null ? [] : [sampleSeed])],
    );
    return rows[0] ?? null;
  },

  async nextDue(site: string): Promise<Date | null> {
    const row = await pg('crawl_page')
      .where({ site, status: 'queued' })
      .min({ due: 'next_attempt_at' })
      .first();
    return row?.due ?? null;
  },

  async update(
    site: string,
    url: string,
    { body, ...update }: PageUpdate,
  ): Promise<void> {
    const stored = body && {
      body: null,
      body_key: pageKey(site, url),
    };
    if (stored) {
      await pagesBucket(pages).put(stored.body_key, body, {
        contentType: 'application/gzip',
      });
    }
    await pg('crawl_page')
      .where({ site, url })
      .update({ ...update, ...stored });
  },

  async pause(site: string, reason: PauseReason): Promise<void> {
    await pg('crawl_run')
      .where({ site })
      .whereIn('status', ['queued', 'running'])
      .update({ status: 'paused', paused_reason: reason });
  },

  async beat(sites: string[], now: Date): Promise<void> {
    await pg('crawl_run').whereIn('site', sites).update({ heartbeat_at: now });
  },

  async workerSeenAt(): Promise<Date | null> {
    const row = await pg('crawl_run').max({ seen: 'heartbeat_at' }).first();
    return row?.seen ?? null;
  },

  async finish(site: string, now: Date): Promise<void> {
    await pg('crawl_run')
      .where({ site })
      .update({ status: 'done', finished_at: now });
  },

  async progress(sites: string[]): Promise<CrawlProgress[]> {
    const runs: CrawlRun[] = await pg('crawl_run').whereIn('site', sites);
    const counts: { site: string; status: PageStatus; count: string }[] =
      await pg('crawl_page')
        .select('site', 'status')
        .count({ count: '*' })
        .whereIn('site', sites)
        .groupBy('site', 'status');
    const failures: { site: string; error: FailureReason; count: string }[] =
      await pg('crawl_page')
        .select('site', 'error')
        .count({ count: '*' })
        .whereIn('site', sites)
        .andWhere({ status: 'failed' })
        .groupBy('site', 'error');
    return sites.map((site) => ({
      site,
      run: runs.find((run) => run.site === site) ?? null,
      pages: tally(
        PAGE_STATUSES,
        (status) =>
          counts.find((row) => row.site === site && row.status === status)
            ?.count,
      ),
      failures: tally(
        FAILURE_REASONS,
        (error) =>
          failures.find((row) => row.site === site && row.error === error)
            ?.count,
      ),
    }));
  },

  async snapshots(
    site: string,
    after: string | null,
    limit: number,
  ): Promise<{ url: string; body: Buffer | null }[]> {
    const rows: {
      url: string;
      body: Buffer | null;
      body_key: string | null;
    }[] = await pg('crawl_page')
      .select('url', 'body', 'body_key')
      .where({ site, status: 'done' })
      .andWhere((query) =>
        query.whereNotNull('body').orWhereNotNull('body_key'),
      )
      .andWhere('url', '>', after ?? '')
      .orderBy('url')
      .limit(limit);
    return Promise.all(
      rows.map(async ({ url, body, body_key }) => ({
        url,
        body: body ?? (await pagesBucket(pages).get(body_key!)),
      })),
    );
  },
});

export type CrawlStore = ReturnType<typeof crawlStore>;
