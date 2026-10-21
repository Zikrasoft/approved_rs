export function sitemapFilter(site: string): (page: string) => boolean {
  const excluded = ['/thanks/', '/parts/p/', '/parts/car/', '/parts/cart/'];
  return (page) =>
    page !== `${site}/` && !excluded.some((part) => page.includes(part));
}
