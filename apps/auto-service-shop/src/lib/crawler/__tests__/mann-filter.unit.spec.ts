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
      supplier_vehicle_id: '00000000146042',
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

  it('reads a car whose link carries a malformed escape without its supplier id', () => {
    const html = page('hu816x.html.gz').replace(
      '%26vehicleTypeId%3D00000000146042',
      '%26vehicleTypeId%3D00000000146042%E0%A4%A',
    );
    const article = supplierArticleSchema.parse(mannFilter.parse(html));
    expect(article.vehicles).toHaveLength(105);
    expect(article.vehicles?.[0]).toMatchObject({ variant: '125i (E82/E88)' });
    expect(article.vehicles?.[0].supplier_vehicle_id).toBeUndefined();
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
    const html = page('0101410065.html.gz')
      .replace(
        'cmp-product__title-family">MANN+HUMMEL Spare Part',
        'cmp-product__title-family">Oil Filter',
      )
      .replace(
        'cmp-product__title-section--family-other',
        'cmp-product__title-section--family-o',
      );
    expect(mannFilter.parse(html)?.specs).toEqual({
      'Spare part description': 'HEXAGON SCREW M10_65.0_',
    });
  });

  it('reads nothing from a MANN+HUMMEL spare part page, a screw or a plug for a filter housing', () => {
    expect(mannFilter.parse(page('0101410065.html.gz'))).toBe(null);
  });

  it('reads nothing from an industrial filter page that fits no vehicle, a spark erosion filter', () => {
    expect(mannFilter.parse(page('h341158-22.html.gz'))).toBe(null);
  });

  it('names a car by its designation and chassis, its tooltip lines becoming notes', () => {
    const vehicles = mannFilter.parse(page('hu816x.html.gz'))?.vehicles ?? [];
    expect(vehicles).toContainEqual(
      expect.objectContaining({
        model: '5',
        variant: '535i (F10/F11)',
        chassis_codes: ['F10', 'F11'],
        notes: ['For aluminium oil filter module'],
      }),
    );
    expect(vehicles).toContainEqual(
      expect.objectContaining({
        variant: '535i (E60/61)',
        chassis_codes: ['E60', 'E61'],
      }),
    );
    expect(
      vehicles.filter(({ variant }) => /aluminium|→/u.test(variant)),
    ).toEqual([]);
  });

  it('reads chassis codes from outside the designation and dates as notes', () => {
    const vehicles = mannFilter.parse(page('c30005.html.gz'))?.vehicles ?? [];
    expect(vehicles).toContainEqual(
      expect.objectContaining({
        variant: '2.0 TFSI (TTS) (FV)',
        chassis_codes: ['FV'],
      }),
    );
    expect(vehicles).toContainEqual(
      expect.objectContaining({
        model: 'Tiguan Allspace',
        variant: '2.0 TDI',
        notes: ['→ 11/24'],
      }),
    );
  });

  it('fits no Lamborghini tractor, which the site names like the car maker', () => {
    const html = page('hu816x.html.gz').replaceAll(
      'cmp-accordion__title">BMW',
      'cmp-accordion__title">LAMBORGHINI',
    );
    expect(
      new Set(mannFilter.parse(html)?.vehicles?.map(({ make }) => make)),
    ).toEqual(new Set(['LAMBORGHINI ALPINA B. BOVENSIEPEN']));
  });

  it('leaves out a row the site gives no model line for and reads the rest', () => {
    const html = page('hu816x.html.gz').replace(
      'cmp-accordion__title">1 (E81/E82/E87/E88)',
      'cmp-accordion__title">(E81/E82/E87/E88)',
    );
    const article = supplierArticleSchema.parse(mannFilter.parse(html));
    expect(article.vehicles?.length).toBeGreaterThan(0);
    expect(
      article.vehicles?.filter(({ variant }) => variant === '125i (E82/E88)'),
    ).toEqual([]);
  });

  it('reads nothing from a page that is not a product', () => {
    expect(mannFilter.parse('<html><body><main></main></body></html>')).toBe(
      null,
    );
  });
});
