import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { supplierArticleSchema } from '../../suppliers/adapter';
import { sitemapLinks } from '../sitemap';
import { filtron } from '../sites/filtron';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', 'filtron', name));
const page = (name: string) => gunzipSync(fixture(name)).toString('utf8');

describe('FILTRON', () => {
  it('seeds from the Serbian commerce sitemap and keeps only product pages', () => {
    expect(filtron.sitemaps).toEqual([
      'https://filtron.eu/sr.sitemap-commerce.xml',
    ]);
    const { pages } = sitemapLinks(fixture('sr.sitemap-commerce.xml'));
    expect(pages.filter(filtron.isPage)).toEqual([
      'https://filtron.eu/sr/catalog/search-results/product.html/pp987/3_filtron.html',
      'https://filtron.eu/sr/catalog/search-results/product.html/k1477_filtron.html',
      'https://filtron.eu/sr/catalog/search-results/product.html/k1477a_filtron.html',
      'https://filtron.eu/sr/catalog/search-results/product.html/ap059/3_filtron.html',
      'https://filtron.eu/sr/catalog/search-results/product.html/pp964/5_filtron.html',
    ]);
    expect(filtron.isPage('https://filtron.eu/sr.html')).toBe(false);
    expect(
      filtron.isPage(
        'https://filtron.eu/en/catalog/search-results/product.html/k1477_filtron.html',
      ),
    ).toBe(false);
  });

  it('renders pages in a browser and waits for the product form', () => {
    expect(filtron).toMatchObject({
      fetchMode: 'browser',
      waitFor: 'form[data-product-sku]',
    });
  });

  it('reads a cabin filter page into an article', () => {
    const article = supplierArticleSchema.parse(
      filtron.parse(page('k1477.html.gz')),
    );
    expect(article).toEqual({
      article_id: 'K1477_FILTRON',
      brand: 'FILTRON',
      number: 'K 1477',
      name: 'Filter kabine | Čestice K 1477',
      category: 'Filter kabine | Čestice',
      description: expect.stringMatching(
        /^Način rada: Elektrostatička .* svakih 15\.000 km ili jednom godišnje\.$/u,
      ),
      specs: {
        'Dužina (A)': '260 mm',
        'Širina (B)': '201 mm',
        'Visina (H)': '38 mm',
        GTIN: '5904608804778',
      },
      cross_references: [{ brand: 'FOMOCO', number: 'KL3Z-19N619-AA' }],
      vehicles: [
        {
          make: 'FORD USA',
          model: 'F-150 Lightning',
          variant: 'EV',
          chassis_codes: [],
          engine_codes: [],
          displacement_cc: null,
          power_kw: 337,
          fuel: null,
          body_style: null,
          year_from: 2023,
          year_to: null,
          notes: [],
          supplier_vehicle_id: '00000005320232',
        },
      ],
      images: [
        'https://s7g10.scene7.com/is/image/mannhummel/K_1477-1',
        'https://s7g10.scene7.com/is/image/mannhummel/K_1477-filter-with-box',
        'https://s7g10.scene7.com/is/image/mannhummel/K_1477-dim-mm',
      ],
    });
  });

  it('fits a filter to trucks and buses but not to industrial engines or a snow groomer', () => {
    const makes = new Set(
      filtron.parse(page('am416.html.gz'))?.vehicles?.map(({ make }) => make),
    );
    expect([...makes].sort()).toEqual([
      'DAF BUS (VDL BUS GROUP)',
      'DAF TRUCKS',
      'IVECO BUS',
      'JELCZ',
      'LEYLAND',
      'LEYLAND-DAF',
      'NEOPLAN (NEOMAN)',
      'SCANIA',
      'SCANIA BUS / SCANIA-IRIZAR',
      'SOLARIS BUS',
      'VAN HOOL',
    ]);
  });
});
