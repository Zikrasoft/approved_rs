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
    expect(article.vehicles).toHaveLength(105);
    expect(article.vehicles?.[0]).toEqual({
      make: 'BMW',
      model: '1',
      variant: '125i (E82/E88)',
      chassis_codes: ['E82', 'E88'],
      engine_codes: ['N52 B30A'],
      displacement_cc: 2996,
      power_kw: 160,
      fuel: null,
      body_style: null,
      year_from: 2008,
      year_to: 2013,
      notes: [],
    });
    expect(article.vehicles).toContainEqual(
      expect.objectContaining({
        variant: '128i (E82/E88)',
        power_kw: 169,
        year_from: 2008,
        year_to: null,
      }),
    );
    expect(article.vehicles).toContainEqual(
      expect.objectContaining({
        model: '2',
        variant: 'M235i (F22, F23)',
        chassis_codes: ['F22', 'F23'],
        engine_codes: ['N55B30A'],
      }),
    );
    expect(article.applicability).toBeUndefined();
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
    expect(article.vehicles).toHaveLength(308);
  });

  it('reads a spec the site writes with a doubled colon', () => {
    const html = page('0101410065.html.gz').replace(
      'cmp-product__title-family">MANN+HUMMEL Spare Part',
      'cmp-product__title-family">Oil Filter',
    );
    expect(mannFilter.parse(html)?.specs).toEqual({
      'Spare part description': 'HEXAGON SCREW M10_65.0_',
    });
  });

  it('reads nothing from a MANN+HUMMEL spare part page, a screw or a plug for a filter housing', () => {
    expect(mannFilter.parse(page('0101410065.html.gz'))).toBe(null);
  });

  it('reads nothing from a page that is not a product', () => {
    expect(mannFilter.parse('<html><body><main></main></body></html>')).toBe(
      null,
    );
  });
});
