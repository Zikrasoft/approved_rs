import { parseEnv } from '../../env';
import type { CrawledSite } from '../site';
import { mannFilter } from './mann-filter';
import { varta } from './varta';

export const CRAWLED_SITES: CrawledSite[] = [mannFilter, varta];

export const enabledCrawledSites = (): CrawledSite[] => {
  const { SUPPLIER_ADAPTERS } = parseEnv(process.env);
  return CRAWLED_SITES.filter(({ key }) => SUPPLIER_ADAPTERS.includes(key));
};
