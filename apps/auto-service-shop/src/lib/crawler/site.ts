import type { Page } from 'playwright';

import type { CrawledSupplierKey } from '../../modules/supplier/keys';
import type { SupplierArticle } from '../suppliers/adapter';
import type { FetchMode } from './fetcher';
import type { SitemapEntry } from './sitemap';

export type CrawledSite = {
  key: CrawledSupplierKey;
  name: string;
  origin: string;
  sitemaps: string[];
  floorMs: number;
  fetchMode?: FetchMode;
  locale?: string;
  waitFor?: string;
  goneWhen?: string;
  interact?: (page: Page) => Promise<void>;
  isPage: (url: string) => boolean;
  sitemapPage?: (entry: SitemapEntry) => boolean;
  parse: (html: string, categoryHint?: string | null) => SupplierArticle | null;
};
