import { ModulesSdkUtils } from '@medusajs/framework/utils';

import { parseEnv } from '../env';
import { type Clock, crawlSite } from './crawl';
import { crawleeFetcher } from './fetcher';
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
  const names = CRAWLED_SITES.map(({ name }) => name);
  console.log('Crawler waiting for a crawl started in the admin');
  for (;;) {
    const name = await store.next(names, new Date(clock.now()));
    const site = CRAWLED_SITES.find((one) => one.name === name);
    if (!site) {
      await clock.sleep(POLL_MS);
      continue;
    }
    console.log(`Crawling ${site.name}`);
    try {
      await crawlSite(site, {
        store,
        openFetcher: crawleeFetcher,
        clock,
        from: env.CRAWLER_FROM,
      });
      const run = await store.run(site.name);
      console.log(
        `Crawl of ${site.name} ${run?.status ?? 'stopped'}${run?.paused_reason ? `: ${run.paused_reason}` : ''}`,
      );
    } catch (error) {
      console.error(`Crawl of ${site.name} failed`, error);
      await clock.sleep(POLL_MS);
    }
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
