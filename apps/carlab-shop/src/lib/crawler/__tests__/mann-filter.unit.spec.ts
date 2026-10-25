import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { supplierArticleSchema } from '../../suppliers/adapter';
import { sitemapLinks } from '../sitemap';
import { mannFilter } from '../sites/mann-filter';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', 'mann-filter', name));
const page = (name: string) => gunzipSync(fixture(name)).toString('utf8');

describe('MANN-FILTER', () => {
  it('seeds from the English commerce sitemap and keeps only product pages', () => {
    const { pages, sitemaps } = sitemapLinks(
      fixture('en.sitemap-commerce.xml'),
    );
    expect(sitemaps).toEqual([]);
    expect(pages.filter(mannFilter.isPage)).toEqual([
      'https://www.mann-filter.com/en/catalog/search-results/product.html/cud41008_mann-filter.html',
      'https://www.mann-filter.com/en/catalog/search-results/product.html/cud54006_mann-filter.html',
      'https://www.mann-filter.com/en/catalog/search-results/product.html/cud52016_mann-filter.html',
      'https://www.mann-filter.com/en/catalog/search-results/product.html/hu816x_mann-filter.html',
      'https://www.mann-filter.com/en/catalog/search-results/product.html/c30005_mann-filter.html',
    ]);
    expect(mannFilter.sitemaps).toEqual([
      'https://www.mann-filter.com/en.sitemap-commerce.xml',
    ]);
    expect(mannFilter.isPage('https://www.mann-filter.com/en.html')).toBe(
      false,
    );
  });

  it('reads an oil filter page into an article', () => {
    const article = supplierArticleSchema.parse(
      mannFilter.parse(page('hu816x.html.gz')),
    );
    expect(article).toMatchObject({
      article_id: 'HU816X_MANN-FILTER',
      brand: 'MANN-FILTER',
      number: 'HU 816 x',
      name: 'Oil Filter HU 816 x',
      category: 'Oil Filter',
      specs: {
        'Outer diameter (A)': '74 mm',
        'Inner diameter (B)': '41 mm',
        'Inner diameter 1 (C)': '41 mm',
        'Height (H)': '79 mm',
        Features: 'with gasket',
        GTIN: '4011558296407',
      },
      cross_references: [
        { brand: 'BMW', number: '11 42 8 683 196' },
        { brand: 'BMW', number: '11 42 7 953 129' },
        { brand: 'BMW', number: '11 42 7 523 201' },
        { brand: 'BMW', number: '11 42 7 541 827' },
        { brand: 'BMW', number: '11 42 7 566 327' },
      ],
      images: [
        'https://s7g10.scene7.com/is/image/mannhummel/HU_816_x',
        'https://s7g10.scene7.com/is/image/mannhummel/HU_816_x-filter-with-box',
        'https://s7g10.scene7.com/is/image/mannhummel/HU_816_x-all',
        'https://s7g10.scene7.com/is/image/mannhummel/HU_816_x-dim',
      ],
    });
    expect(article.description).toMatch(
      /^MANN-FILTER oil filters: Top filtration performance .* entire maintenance interval\.$/,
    );
    expect(article.applicability).toHaveLength(105);
    expect(article.applicability?.[0]).toBe(
      'BMW 1 (E81/E82/E87/E88) 125i (E82/E88) N52 B30A 2996 ccm 160 kW 03/08 → 10/13',
    );
    expect(article.applicability).toContain(
      'BMW 1 (E81/E82/E87/E88) 128i (E82/E88) N52 B30A 2996 ccm 169 kW 03/08 →',
    );
  });

  it('reads cross-references grouped under several car makers', () => {
    const article = supplierArticleSchema.parse(
      mannFilter.parse(page('c30005.html.gz')),
    );
    expect(article).toMatchObject({
      article_id: 'C30005_MANN-FILTER',
      number: 'C 30 005',
      category: 'Air Filter',
      specs: {
        'Length (A)': '292 mm',
        'Width (B)': '177 mm',
        'Height (H)': '70 mm',
        'Sustainable feature': 'With lignin',
        GTIN: '4011558028725',
      },
    });
    expect(
      new Set(article.cross_references?.map(({ brand }) => brand)),
    ).toEqual(new Set(['FOMOCO', 'FORD', 'VW GROUP (AUDI/SEAT/SKODA/VW)']));
    expect(article.cross_references).toHaveLength(5);
    expect(article.applicability).toHaveLength(308);
  });

  it('reads a spec the site writes with a doubled colon', () => {
    expect(mannFilter.parse(page('0101410065.html.gz'))?.specs).toEqual({
      'Spare part description': 'HEXAGON SCREW M10_65.0_',
    });
  });

  it('reads nothing from a page that is not a product', () => {
    expect(mannFilter.parse('<html><body><main></main></body></html>')).toBe(
      null,
    );
  });
});
