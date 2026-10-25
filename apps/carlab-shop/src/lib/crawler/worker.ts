import { ModulesSdkUtils } from '@medusajs/framework/utils';

import { parseEnv } from '../env';
import { type Clock, crawlSite } from './crawl';
import { CRAWLED_SITES } from './sites';
import { crawlStore } from './store';

const POLL_MS = 5000;

const clock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// TODO: CRAWLER_FROM stays unset until the owner names a mailbox the crawler's operators read; the From header is sent only once it is set.
async function main(): Promise<void> {
  const env = parseEnv(process.env);
  const store = crawlStore(
    ModulesSdkUtils.createPgConnection({
      clientUrl: env.DATABASE_URL,
      driverOptions: env.DATABASE_SSL
        ? { ssl: { rejectUnauthorized: false } }
        : {},
      pool: { min: 0, max: 4 },
    }),
  );
  const active = new Set<string>();
  console.log('Crawler waiting for a crawl started in the admin');
  for (;;) {
    const running = await store.runningSites();
    for (const site of CRAWLED_SITES) {
      if (!running.includes(site.name) || active.has(site.name)) continue;
      active.add(site.name);
      console.log(`Crawling ${site.name}`);
      crawlSite(site, { store, fetch, clock, from: env.CRAWLER_FROM })
        .then(async () => {
          const run = await store.run(site.name);
          console.log(
            `Crawl of ${site.name} ${run?.status ?? 'stopped'}${run?.paused_reason ? `: ${run.paused_reason}` : ''}`,
          );
        })
        .catch((error: unknown) =>
          console.error(`Crawl of ${site.name} failed`, error),
        )
        .finally(() => active.delete(site.name));
    }
    await clock.sleep(POLL_MS);
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
