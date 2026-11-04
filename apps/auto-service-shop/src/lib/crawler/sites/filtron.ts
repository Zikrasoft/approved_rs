import type { CrawledSite } from '../site';
import { parseMannHummelProduct } from './mann-filter';

const PRODUCT_PAGE =
  /^https:\/\/filtron\.eu\/sr\/catalog\/search-results\/product\.html\/.+_filtron\.html$/u;

export const filtron: CrawledSite = {
  key: 'filtron',
  name: 'FILTRON',
  origin: 'https://filtron.eu',
  sitemaps: ['https://filtron.eu/sr.sitemap-commerce.xml'],
  floorMs: 2000,
  fetchMode: 'browser',
  waitFor: 'form[data-product-sku]',
  isPage: (url) => PRODUCT_PAGE.test(url),
  parse: parseMannHummelProduct,
};
