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
  isPage: (url: string) => boolean;
  parse: (html: string) => SupplierArticle | null;
};
