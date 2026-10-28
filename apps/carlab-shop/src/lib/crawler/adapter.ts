import { gunzipSync } from 'node:zlib';

import {
  type SupplierAdapter,
  supplierArticleSchema,
  type SupplierArticle,
  type UnreadablePage,
} from '../suppliers/adapter';
import type { CrawledSite } from './site';
import type { CrawlStore } from './store';
import { errorMessage } from '../errors';

const SNAPSHOTS_PER_PAGE = 50;

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
    let notInScope = 0;
    for (const { url, body } of snapshots) {
      try {
        if (!body) throw new Error('The stored page is missing from S3');
        const article = site.parse(gunzipSync(body).toString('utf8'));
        if (article) articles.push(supplierArticleSchema.parse(article));
        else notInScope += 1;
      } catch (error) {
        unreadable.push({ url, reason: errorMessage(error) });
      }
    }
    return {
      articles,
      unreadable,
      not_in_scope: notInScope,
      next:
        snapshots.length === pageSize
          ? snapshots[snapshots.length - 1].url
          : null,
    };
  },
  quote: async () => [],
});
