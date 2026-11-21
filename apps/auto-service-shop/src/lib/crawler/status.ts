import { ModulesSdkUtils } from '@medusajs/framework/utils';

import { parseCrawlerEnv } from '../env';
import { CRAWLED_SITES } from './sites';
import { crawlStore } from './store';

async function main(): Promise<void> {
  const env = parseCrawlerEnv(process.env);
  const pg = ModulesSdkUtils.createPgConnection({
    clientUrl: env.DATABASE_URL,
    driverOptions: env.DATABASE_SSL
      ? { ssl: { rejectUnauthorized: false } }
      : {},
    pool: { min: 0, max: 1 },
  });
  const progress = await crawlStore(pg, null).progress(
    CRAWLED_SITES.map(({ key }) => key),
  );
  for (const { site, run, pages } of progress) {
    const reason = run?.paused_reason ? `: ${run.paused_reason}` : '';
    console.log(
      `${site} ${run?.status ?? 'never run'}${reason}`,
      JSON.stringify(pages),
    );
  }
  await pg.destroy();
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
