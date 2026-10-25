import { load } from 'cheerio/slim';

export const sitemapLinks = (xml: string) => {
  const $ = load(xml, { xml: true });
  const locs = (parent: string) =>
    $(`${parent} > loc`)
      .map((_, loc) => $(loc).text().trim())
      .get()
      .filter(Boolean);
  return { pages: locs('url'), sitemaps: locs('sitemap') };
};
