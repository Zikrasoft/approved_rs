export function sitemapFilter(site: string): (page: string) => boolean {
  const excluded = ['/thanks/', '/parts/car/', '/parts/p/'];
  return (page) =>
    page !== `${site}/` && !excluded.some((part) => page.includes(part));
}
