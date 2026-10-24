const PART_PAGE_SEGMENT = '/parts/p/';

export function sitemapFilter(
  site: string,
  partPages: { slug: string; indexable: boolean }[] = [],
): (page: string) => boolean {
  const excluded = ['/thanks/', '/parts/car/', '/parts/cart/'];
  const indexable = new Set(
    partPages.filter((page) => page.indexable).map(({ slug }) => slug),
  );
  return (page) => {
    const [, partSlug] = page.split(PART_PAGE_SEGMENT);
    return (
      page !== `${site}/` &&
      !excluded.some((part) => page.includes(part)) &&
      (partSlug === undefined || indexable.has(partSlug.replace(/\/$/, '')))
    );
  };
}
