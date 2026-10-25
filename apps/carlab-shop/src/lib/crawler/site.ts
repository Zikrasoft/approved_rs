import type { SupplierAdapterName } from '../env';
import type { SupplierArticle } from '../suppliers/adapter';

export type CrawledSite = {
  key: SupplierAdapterName;
  name: string;
  origin: string;
  sitemaps: string[];
  floorMs: number;
  isPage: (url: string) => boolean;
  parse: (html: string) => SupplierArticle | null;
};
