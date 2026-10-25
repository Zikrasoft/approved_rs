import { type CheerioAPI, load } from 'cheerio/slim';
import { z } from 'zod';

import type { SupplierArticle } from '../../suppliers/adapter';
import type { CrawledSite } from '../site';

export const BILSTEIN_FAMILIES = [
  'filter',
  'kočio',
  'kočni',
  'istrošenosti',
  'amortizer',
  'opruga šasije',
  'opružnu nogu',
  'rame',
  'ramena',
  'spon[ae]',
  'aksijalni zglob',
  'kugla$',
  'kuglasti zglob',
  'stabilizator',
  'odbojn',
  'manžetn[ae] upravljača',
  'svećic',
  'kaiš',
  'španer remena',
  'metlic',
];

const FAMILY = new RegExp(
  `(?:^|[\\s/-])(?:${BILSTEIN_FAMILIES.join('|')})`,
  'u',
);

const words = (text: string) => text.replace(/\s+/gu, ' ').trim();

const inFamily = (name: string) => FAMILY.test(words(name).toLowerCase());

const ORIGIN = 'https://partsfinder.bilsteingroup.com';
const ARTICLE_PAGE =
  /^https:\/\/partsfinder\.bilsteingroup\.com\/sr\/article\/(?:febi|SWAG|blueprint)\/[^/]+$/u;

const sitemapPages = (xml: string) => {
  const $ = load(xml, { xml: true });
  return $('url')
    .toArray()
    .filter((url) =>
      $(url)
        .find('image\\:title')
        .toArray()
        .some((title) => inFamily($(title).text())),
    )
    .map((url) => $(url).children('loc').text().trim());
};

const bgImagesSchema = z.array(
  z.object({ brandId: z.number(), imageNames: z.array(z.string().min(1)) }),
);

const parsedJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const each = ($: CheerioAPI, selector: string) =>
  $(selector)
    .toArray()
    .map((node) => words($(node).text()))
    .filter(Boolean);

const imagesOf = ($: CheerioAPI) => {
  const images = bgImagesSchema.safeParse(
    parsedJson($('article-detail-image').attr(':bg-images') ?? '[]'),
  );
  if (!images.success) return [];
  return images.data.flatMap(({ brandId, imageNames }) =>
    imageNames.map(
      (name) =>
        `https://cdn.partsfinder.bilsteingroup.com/pf-article-zoomed/${brandId}/${encodeURIComponent(name)}`,
    ),
  );
};

const crossReferencesOf = ($: CheerioAPI) =>
  $('.detailpage-number-table tbody tr')
    .toArray()
    .flatMap((row) => {
      const [brand, numbers] = $(row)
        .children('td')
        .toArray()
        .map((cell) => words($(cell).text()));
      return (numbers ?? '')
        .split(' | ')
        .filter(Boolean)
        .map((number) => ({ brand, number }));
    });

const CRITERION = /^(.+?):\s*(.+)$/u;
const NEXT_CRITERION = /\s+(?=\p{Lu}[\p{Ll}\s]*:)/u;

const criteriaOf = (meta: string, makes: string[]): Record<string, string> => {
  const lead = ` odgovarajući za ${makes.join(', ')}`;
  const at = meta.indexOf(lead);
  if (at < 0) return {};
  return Object.fromEntries(
    meta
      .slice(at + lead.length)
      .split(NEXT_CRITERION)
      .map((part) => CRITERION.exec(part.trim()))
      .filter((pair) => pair !== null)
      .map((pair) => [pair[1], pair[2]]),
  );
};

const setContentsOf = ($: CheerioAPI) =>
  $('.repKitSol-div-padding tbody tr')
    .toArray()
    .map((row) => {
      const cells = $(row)
        .children('td')
        .toArray()
        .map((cell) => $(cell));
      const [number, name, quantity] = [
        words(cells[0]?.find('strong').text() ?? ''),
        words(cells[1]?.text() ?? ''),
        words(cells[2]?.text() ?? ''),
      ];
      return `${quantity} x ${number} ${name}`;
    })
    .join('; ');

export const parseBilsteinArticle = (html: string): SupplierArticle | null => {
  const $ = load(html);
  const [brand, , name] = $('title').text().split(' | ').map(words);
  const app = $('#app');
  const number = words(app.attr('data-bg-number') ?? '');
  const brandPath = $('[bg-brand-name]').first().attr('bg-brand-name');
  if (!brand || !name || !number || !brandPath || !inFamily(name)) return null;
  const crossReferences = crossReferencesOf($);
  const makes = [...new Set(crossReferences.map(({ brand }) => brand))];
  const specs = criteriaOf(
    words($('meta[name="description"]').attr('content') ?? ''),
    makes,
  );
  const contents = setContentsOf($);
  if (contents) specs['Sadržaj seta'] = contents;
  const description = each($, '.desc-bullet-points li').join('; ');
  return {
    article_id: `${brandPath}/${number}`,
    brand,
    number,
    name,
    category: name,
    ...(description && { description }),
    specs,
    cross_references: crossReferences,
    images: imagesOf($),
  };
};

export const bilstein: CrawledSite = {
  key: 'bilstein',
  name: 'bilstein group',
  origin: ORIGIN,
  sitemaps: [`${ORIGIN}/sitemaps/sr/sitemap-index.xml`],
  floorMs: 5000,
  isPage: (url) => ARTICLE_PAGE.test(url),
  sitemapPages,
  parse: parseBilsteinArticle,
};
