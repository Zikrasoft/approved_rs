import { gunzipSync } from 'node:zlib';

import type { SupplierAdapter, SupplierArticle } from '../suppliers/adapter';
import type { CrawledSite } from './site';
import type { CrawlStore } from './store';

const SNAPSHOTS_PER_PAGE = 50;

export const crawledSupplierAdapter = (
  site: CrawledSite,
  store: CrawlStore,
  pageSize = SNAPSHOTS_PER_PAGE,
): SupplierAdapter => ({
  name: site.name,
  listCatalogue: async (cursor) => {
    const snapshots = await store.snapshots(site.name, cursor, pageSize);
    return {
      articles: snapshots
        .map(({ body }) => site.parse(gunzipSync(body).toString('utf8')))
        .filter((article): article is SupplierArticle => article !== null),
      next:
        snapshots.length === pageSize
          ? snapshots[snapshots.length - 1].url
          : null,
    };
  },
  quote: async () => [],
});
