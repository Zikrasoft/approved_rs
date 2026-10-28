import { type CheerioAPI, load } from 'cheerio/slim';
import { z } from 'zod';

import type { SupplierArticle, VehicleFacts } from '../../suppliers/adapter';
import { imageUrls, parsedJson, words } from '../page-parsing';
import type { CrawledSite } from '../site';

const productLdSchema = z.object({
  '@type': z.literal('Product'),
  brand: z.object({ name: z.string().trim().min(1) }),
});

const galleryItemsSchema = z.array(
  z.object({ path: z.url(), type: z.string() }),
);

type Nodes = ReturnType<CheerioAPI>;

const brandOf = ($: CheerioAPI): string | null => {
  for (const script of each($, $('script[type="application/ld+json"]'))) {
    const ld = productLdSchema.safeParse(parsedJson(script.text()));
    if (ld.success) return ld.data.brand.name;
  }
  return null;
};

const SPARE_PART = /^MANN\+HUMMEL Spare Part$/iu;
const OTHER_FAMILY = '.cmp-product__title-section--family-other';

const SPEC_PAIR = /^(.+?)\s*[=:]+\s*(.+)$/u;
const MAIN_APPLICATION = /^(main application|glavna primena)\b/iu;

const specsOf = ($: CheerioAPI): Record<string, string> => {
  const specs: Record<string, string> = {};
  const features: string[] = [];
  for (const item of each($, $('.cmp-product__summary li'))) {
    const line = words(item.text());
    if (!line || MAIN_APPLICATION.test(line)) continue;
    const pairs = line.split(/\s*;\s*/u).map((part) => SPEC_PAIR.exec(part));
    if (pairs.every(Boolean)) {
      for (const pair of pairs) specs[pair![1]] = pair![2];
    } else {
      features.push(line);
    }
  }
  if (features.length) specs.Features = features.join('; ');
  const gtin = /\d{8,14}/u.exec(
    words($('.cmp-product__sku-value').text()),
  )?.[0];
  if (gtin) specs.GTIN = gtin;
  return specs;
};

const accordionTitle = (item: Nodes) =>
  words(item.find('.cmp-accordion__title').first().text());

const each = ($: CheerioAPI, nodes: Nodes): Nodes[] =>
  nodes.toArray().map((node) => $(node));

const crossReferencesOf = ($: CheerioAPI) =>
  each($, $('#oeNumbers .cmp-accordion__nested .cmp-accordion__item')).flatMap(
    (item) => {
      const brand = accordionTitle(item);
      return each($, item.find('li'))
        .map((number) => ({ brand, number: words(number.text()) }))
        .filter(({ number }) => number);
    },
  );

const CODES = /\(([^)]+)\)/u;
const MONTH_YEAR = /\d{2}\/(\d{2})/gu;

const codesIn = (text: string) =>
  CODES.exec(text)?.[1]
    .split(/\s*[/,]\s*/u)
    .filter(Boolean) ?? [];

const withoutCodes = (text: string) => text.replace(CODES, '').trim();

const yearsOf = (text: string) => {
  const [from, to] = text.split('→').map((side) => {
    const yy = [...side.matchAll(MONTH_YEAR)][0]?.[1];
    return yy ? Number(yy) + (Number(yy) < 50 ? 2000 : 1900) : null;
  });
  return { year_from: from ?? null, year_to: to ?? null };
};

const count = (text: string | undefined) => Number(text) || null;

const OFF_ROAD_MAKE = /\b(?:ENGINES|MOTORCYCLES?|MARINE|TRACTORS?)\b/u;

const OFF_ROAD_MAKER =
  /^(?:AGCO|BOMAG|CASE IH|CATERPILLAR|CLAAS|DEUTZ-FAHR|DOOSAN|DYNAPAC|FENDT|HAMM|HYSTER|IMT|JCB|JOHN DEERE|JUNGHEINRICH|KOMATSU|KUBOTA|LIEBHERR|MANITOU|MASSEY FERGUSON|NEW HOLLAND|PERKINS|PRINOTH|TAKEUCHI|VALTRA|WACKER NEUSON|YANMAR|ZETOR)\b/u;

const onTheRoad = ({ make }: VehicleFacts) =>
  !OFF_ROAD_MAKE.test(make.toUpperCase()) &&
  !OFF_ROAD_MAKER.test(make.toUpperCase());

const vehiclesOf = ($: CheerioAPI): VehicleFacts[] =>
  each($, $('#applications .cmp-application-table')).flatMap((table) => {
    const [series, make] = each($, table.parents('.cmp-accordion__item')).map(
      accordionTitle,
    );
    return each($, table.find('tbody.cmp-table__desktop tr'))
      .map((row) =>
        each($, row.find('td')).map((cell) =>
          words(cell.text()).replace(/^-$/u, ''),
        ),
      )
      .filter((cells) => cells.length >= 7)
      .map(([variant, , engine, ccm, kw, , years]) => ({
        make,
        model: withoutCodes(series),
        variant,
        chassis_codes: codesIn(variant).length
          ? codesIn(variant)
          : codesIn(series),
        engine_codes: engine.split(/\s*,\s*/u).filter(Boolean),
        displacement_cc: count(ccm),
        power_kw: count(kw),
        fuel: null,
        body_style: null,
        ...yearsOf(years),
        notes: [],
      }));
  });

const imagesOf = ($: CheerioAPI): string[] => {
  const gallery = galleryItemsSchema.safeParse(
    parsedJson($('[data-gallery-items]').attr('data-gallery-items') ?? '[]'),
  );
  if (!gallery.success) return [];
  return imageUrls(
    gallery.data.filter(({ type }) => type === 'image').map(({ path }) => path),
  );
};

export const parseMannHummelProduct = (
  html: string,
): SupplierArticle | null => {
  const $ = load(html);
  const articleId = $('form[data-product-sku]').attr('data-product-sku');
  const number = words($('.cmp-product__title-name').first().text());
  const category = words($('.cmp-product__title-family').first().text());
  const brand = brandOf($);
  if (!articleId || !number || !brand || SPARE_PART.test(category)) {
    return null;
  }
  const applications = vehiclesOf($);
  if (!applications.length && $(OTHER_FAMILY).length) return null;
  const vehicles = applications.filter(onTheRoad);
  const description = words($('.cmp-product__description-text').first().text());
  return {
    article_id: articleId,
    brand,
    number,
    name: [category, number].filter(Boolean).join(' '),
    category,
    ...(description && { description }),
    specs: specsOf($),
    cross_references: crossReferencesOf($),
    vehicles,
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
