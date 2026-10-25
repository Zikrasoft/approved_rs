import type { SupplierAdapterName } from '../env';
import type { SupplierArticle } from '../suppliers/adapter';
import type { FetchMode } from './fetcher';

export type CrawledSite = {
  key: SupplierAdapterName;
  name: string;
  origin: string;
  sitemaps: string[];
  floorMs: number;
  fetchMode?: FetchMode;
  waitFor?: string;
  isPage: (url: string) => boolean;
  sitemapPages?: (xml: string) => string[];
  parse: (html: string) => SupplierArticle | null;
};
