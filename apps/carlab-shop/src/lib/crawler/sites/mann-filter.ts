import { type CheerioAPI, load } from 'cheerio/slim';
import { z } from 'zod';

import type { SupplierArticle } from '../../suppliers/adapter';
import type { CrawledSite } from '../site';

const productLdSchema = z.object({
  '@type': z.literal('Product'),
  brand: z.object({ name: z.string().trim().min(1) }),
});

const galleryItemsSchema = z.array(
  z.object({ path: z.url(), type: z.string() }),
);

type Nodes = ReturnType<CheerioAPI>;

const words = (node: { text: () => string }) =>
  node.text().replace(/\s+/gu, ' ').trim();

const brandOf = ($: CheerioAPI): string | null => {
  for (const script of each($, $('script[type="application/ld+json"]'))) {
    const ld = productLdSchema.safeParse(parsedJson(script.text()));
    if (ld.success) return ld.data.brand.name;
  }
  return null;
};

const SPARE_PART = /^MANN\+HUMMEL Spare Part$/iu;

const SPEC_PAIR = /^(.+?)\s*[=:]+\s*(.+)$/u;
const MAIN_APPLICATION = /^(main application|glavna primena)\b/iu;

const specsOf = ($: CheerioAPI): Record<string, string> => {
  const specs: Record<string, string> = {};
  const features: string[] = [];
  for (const item of each($, $('.cmp-product__summary li'))) {
    const line = words(item);
    if (!line || MAIN_APPLICATION.test(line)) continue;
    const pairs = line.split(/\s*;\s*/u).map((part) => SPEC_PAIR.exec(part));
    if (pairs.every(Boolean)) {
      for (const pair of pairs) specs[pair![1]] = pair![2];
    } else {
      features.push(line);
    }
  }
  if (features.length) specs.Features = features.join('; ');
  const gtin = /\d{8,14}/u.exec(words($('.cmp-product__sku-value')))?.[0];
  if (gtin) specs.GTIN = gtin;
  return specs;
};

const accordionTitle = (item: Nodes) =>
  words(item.find('.cmp-accordion__title').first());

const each = ($: CheerioAPI, nodes: Nodes): Nodes[] =>
  nodes.toArray().map((node) => $(node));

const crossReferencesOf = ($: CheerioAPI) =>
  each($, $('#oeNumbers .cmp-accordion__nested .cmp-accordion__item')).flatMap(
    (item) => {
      const brand = accordionTitle(item);
      return each($, item.find('li'))
        .map((number) => ({ brand, number: words(number) }))
        .filter(({ number }) => number);
    },
  );

const withUnit = (value: string | undefined, unit: string) =>
  value ? `${value} ${unit}` : '';

const applicabilityOf = ($: CheerioAPI) =>
  each($, $('#applications .cmp-application-table')).flatMap((table) => {
    const [series, make] = each($, table.parents('.cmp-accordion__item'));
    const prefix = [accordionTitle(make), accordionTitle(series)];
    return each($, table.find('tbody.cmp-table__desktop tr'))
      .map((row) =>
        each($, row.find('td')).map((cell) => words(cell).replace(/^-$/u, '')),
      )
      .filter((cells) => cells.length >= 7)
      .map(([model, , engine, ccm, kw, , years]) =>
        [
          ...prefix,
          model,
          engine,
          withUnit(ccm, 'ccm'),
          withUnit(kw, 'kW'),
          years,
        ]
          .filter(Boolean)
          .join(' '),
      );
  });

const parsedJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const imagesOf = ($: CheerioAPI): string[] => {
  const gallery = galleryItemsSchema.safeParse(
    parsedJson($('[data-gallery-items]').attr('data-gallery-items') ?? '[]'),
  );
  if (!gallery.success) return [];
  const urls = gallery.data
    .filter(({ type }) => type === 'image')
    .map(({ path }) => {
      const url = new URL(path);
      url.search = '';
      return url.href;
    });
  return [...new Set(urls)];
};

export const parseMannHummelProduct = (
  html: string,
): SupplierArticle | null => {
  const $ = load(html);
  const articleId = $('form[data-product-sku]').attr('data-product-sku');
  const number = words($('.cmp-product__title-name').first());
  const category = words($('.cmp-product__title-family').first());
  const brand = brandOf($);
  if (!articleId || !number || !brand || SPARE_PART.test(category)) {
    return null;
  }
  const description = words($('.cmp-product__description-text').first());
  return {
    article_id: articleId,
    brand,
    number,
    name: [category, number].filter(Boolean).join(' '),
    category,
    ...(description && { description }),
    specs: specsOf($),
    cross_references: crossReferencesOf($),
    applicability: applicabilityOf($),
    images: imagesOf($),
  };
};

const PRODUCT_PAGE =
  /^https:\/\/www\.mann-filter\.com\/en\/catalog\/search-results\/product\.html\/.+_mann-filter\.html$/u;

export const mannFilter: CrawledSite = {
  key: 'mann-filter',
  name: 'MANN-FILTER',
  origin: 'https://www.mann-filter.com',
  sitemaps: ['https://www.mann-filter.com/en.sitemap-commerce.xml'],
  floorMs: 2000,
  isPage: (url) => PRODUCT_PAGE.test(url),
  parse: parseMannHummelProduct,
};
