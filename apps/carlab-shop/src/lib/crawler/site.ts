import type { Page } from 'playwright';

import type { SupplierAdapterName } from '../env';
import type { SupplierArticle } from '../suppliers/adapter';
import type { FetchMode } from './fetcher';
import type { SitemapEntry } from './sitemap';

export type CrawledSite = {
  key: SupplierAdapterName;
  name: string;
  origin: string;
  sitemaps: string[];
  floorMs: number;
  fetchMode?: FetchMode;
  waitFor?: string;
  interact?: (page: Page) => Promise<void>;
  isPage: (url: string) => boolean;
  sitemapPage?: (entry: SitemapEntry) => boolean;
  parse: (html: string) => SupplierArticle | null;
};
