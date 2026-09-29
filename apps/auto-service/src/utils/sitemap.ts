import { shopIndexed, type ShopStatus } from './shopStatus';

export function sitemapFilter(
  site: string,
  status: ShopStatus,
): (page: string) => boolean {
  const excluded = [
    '/thanks/',
    '/cart/',
    ...(shopIndexed(status) ? [] : ['/shop/']),
  ];
  return (page) =>
    page !== `${site}/` && !excluded.some((part) => page.includes(part));
}
