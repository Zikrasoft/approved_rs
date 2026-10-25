import type { Knex } from '@medusajs/framework/mikro-orm/knex';

export const PAUSE_REASONS = [
  'robots_unavailable',
  'sitemap_unavailable',
  'forbidden',
  'challenge',
  'server_errors',
] as const;

export type PauseReason = (typeof PAUSE_REASONS)[number];

export const PAGE_STATUSES = ['queued', 'done', 'failed', 'gone'] as const;

type PageStatus = (typeof PAGE_STATUSES)[number];

export type CrawlRun = {
  site: string;
  status: 'running' | 'paused' | 'done';
  paused_reason: PauseReason | null;
  seeded: boolean;
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
  error: string | null;
  etag: string | null;
  last_modified: string | null;
  fetched_at: Date;
  body: Buffer;
}>;

export type CrawlProgress = {
  site: string;
  run: CrawlRun | null;
  pages: Record<PageStatus, number>;
};

const SEED_BATCH = 1000;

export const crawlStore = (pg: Knex) => ({
  async run(site: string): Promise<CrawlRun | null> {
    return (await pg('crawl_run').where({ site }).first()) ?? null;
  },

  async runningSites(): Promise<string[]> {
    return pg('crawl_run').where({ status: 'running' }).pluck('site');
  },

  async start(site: string, now: Date): Promise<void> {
    await pg.raw(
      `insert into crawl_run (site, status, seeded, started_at)
       values (?, 'running', false, ?)
       on conflict (site) do update set
         status = 'running',
         paused_reason = null,
         finished_at = null,
         seeded = crawl_run.seeded and crawl_run.status = 'paused',
         started_at = case when crawl_run.status = 'paused' then crawl_run.started_at else excluded.started_at end`,
      [site, now],
    );
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
  ): Promise<ClaimedPage | null> {
    const { rows } = await pg.raw(
      `update crawl_page set next_attempt_at = ?
       where (site, url) = (
         select site, url from crawl_page
         where site = ? and status = 'queued' and next_attempt_at <= ?
         order by next_attempt_at, url
         limit 1
         for update skip locked
       )
       returning url, attempts, etag, last_modified`,
      [leaseUntil, site, now],
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

  async update(site: string, url: string, update: PageUpdate): Promise<void> {
    await pg('crawl_page').where({ site, url }).update(update);
  },

  async pause(site: string, reason: PauseReason): Promise<void> {
    await pg('crawl_run')
      .where({ site })
      .update({ status: 'paused', paused_reason: reason });
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
    return sites.map((site) => ({
      site,
      run: runs.find((run) => run.site === site) ?? null,
      pages: Object.fromEntries(
        PAGE_STATUSES.map((status) => [
          status,
          Number(
            counts.find((row) => row.site === site && row.status === status)
              ?.count ?? 0,
          ),
        ]),
      ) as Record<PageStatus, number>,
    }));
  },

  async snapshots(
    site: string,
    after: string | null,
    limit: number,
  ): Promise<{ url: string; body: Buffer }[]> {
    return pg('crawl_page')
      .select('url', 'body')
      .where({ site, status: 'done' })
      .whereNotNull('body')
      .andWhere('url', '>', after ?? '')
      .orderBy('url')
      .limit(limit);
  },
});

export type CrawlStore = ReturnType<typeof crawlStore>;
