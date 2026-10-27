import { gunzipSync } from 'node:zlib';

import {
  type SupplierAdapter,
  supplierArticleSchema,
  type SupplierArticle,
  type UnreadablePage,
} from '../suppliers/adapter';
import type { CrawledSite } from './site';
import type { CrawlStore } from './store';

const SNAPSHOTS_PER_PAGE = 50;

const reasonOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const crawledSupplierAdapter = (
  site: CrawledSite,
  store: CrawlStore,
  pageSize = SNAPSHOTS_PER_PAGE,
): SupplierAdapter => ({
  name: site.name,
  listCatalogue: async (cursor) => {
    const snapshots = await store.snapshots(site.name, cursor, pageSize);
    const articles: SupplierArticle[] = [];
    const unreadable: UnreadablePage[] = [];
    for (const { url, body } of snapshots) {
      try {
        if (!body) throw new Error('The stored page is missing from S3');
        const article = site.parse(gunzipSync(body).toString('utf8'));
        if (article) articles.push(supplierArticleSchema.parse(article));
      } catch (error) {
        unreadable.push({ url, reason: reasonOf(error) });
      }
    }
    return {
      articles,
      unreadable,
      next:
        snapshots.length === pageSize
          ? snapshots[snapshots.length - 1].url
          : null,
    };
  },
  quote: async () => [],
});
