import { type CheerioAPI, load } from 'cheerio/slim';

import type { SupplierArticle } from '../../suppliers/adapter';
import type { CrawledSite } from '../site';

const words = (text: string) =>
  text
    .replace(/\u200b/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

const specsOf = ($: CheerioAPI): Record<string, string> =>
  Object.fromEntries(
    $('.products-detail__item')
      .toArray()
      .map((item) => [
        words($(item).find('dt').contents().first().text()),
        words($(item).find('dd').text()),
      ])
      .filter(([label, value]) => label && value),
  );

const imagesOf = ($: CheerioAPI): string[] => {
  const urls = $('.products-detail__media-img img')
    .toArray()
    .flatMap((img) => {
      const src = $(img).attr('src');
      if (!src) return [];
      const url = new URL(src);
      url.search = '';
      return [url.href];
    });
  return [...new Set(urls)];
};

const descriptionOf = ($: CheerioAPI) => {
  const description = $('.products-detail__description').first();
  description.find('h1').remove();
  const benefits = $('.products-detail__benefits-item')
    .toArray()
    .map((item) =>
      [
        words($(item).find('.products-detail__benefits-title').text()),
        words($(item).find('.products-detail__benefits-text').text()),
      ]
        .filter(Boolean)
        .join(': '),
    );
  return [words(description.text()), ...benefits].filter(Boolean).join('\n');
};

const PLACEHOLDER = /^Pseudo Article\b/u;

const technologyOf = (name: string) => name.match(/\b(?:SLI|EFB|AGM)\b/u)?.[0];

export const parseVartaProduct = (html: string): SupplierArticle | null => {
  const $ = load(html);
  const articleId = $('#product-detail-buy-cta').attr('data-article-number');
  const name = words($('.products-detail__title').first().text());
  const specs = specsOf($);
  const number = specs.ETN;
  if (!articleId || !name || !number || PLACEHOLDER.test(name)) return null;
  const description = descriptionOf($);
  const technology = technologyOf(name);
  return {
    article_id: articleId,
    brand: 'VARTA',
    number,
    name,
    category: 'battery',
    ...(description && { description }),
    specs: { ...specs, ...(technology && { Tehnologija: technology }) },
    images: imagesOf($),
  };
};

const PRODUCT_PAGE =
  /^https:\/\/www\.varta-automotive\.com\/sr-latn-rs\/products\/product\/[^/]+$/u;

export const varta: CrawledSite = {
  key: 'varta',
  name: 'VARTA',
  origin: 'https://www.varta-automotive.com',
  sitemaps: ['https://www.varta-automotive.com/sitemap/sitemap-index.xml'],
  floorMs: 2000,
  isPage: (url) => PRODUCT_PAGE.test(url),
  parse: parseVartaProduct,
};
