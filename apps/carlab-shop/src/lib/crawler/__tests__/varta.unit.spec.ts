import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { supplierArticleSchema } from '../../suppliers/adapter';
import { sitemapLinks } from '../sitemap';
import { varta } from '../sites/varta';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', 'varta', name));
const page = (name: string) => gunzipSync(fixture(name)).toString('utf8');

describe('VARTA', () => {
  it('seeds from the sitemap index and keeps only Serbian product pages', () => {
    expect(varta.sitemaps).toEqual([
      'https://www.varta-automotive.com/sitemap/sitemap-index.xml',
    ]);
    expect(sitemapLinks(fixture('sitemap-index.xml')).sitemaps).toEqual([
      'https://www.varta-automotive.com/sitemap/sitemap.xml',
      'https://www.varta-automotive.com/sitemap/sitemap-2.xml',
      'https://www.varta-automotive.com/sitemap/sitemap-3.xml',
    ]);
    const { pages } = sitemapLinks(fixture('sitemap.xml'));
    expect(pages).toHaveLength(5);
    expect(pages.filter(varta.isPage)).toEqual([
      'https://www.varta-automotive.com/sr-latn-rs/products/product/574013068k262',
      'https://www.varta-automotive.com/sr-latn-rs/products/product/8032510008882',
    ]);
  });

  it('reads a car battery page into an article', () => {
    const article = supplierArticleSchema.parse(
      varta.parse(page('574013068k262.html.gz')),
    );
    expect(article).toEqual({
      article_id: '574013068K262',
      brand: 'VARTA',
      number: '574013068',
      name: 'DYNAMIC SLI 574013068',
      category: 'battery',
      description: expect.stringMatching(
        /^Konvencionalna vozila bez Start-Stop tehnologije .* pružaju precizne performanse i dugotrajnu pouzdanost\.$/u,
      ),
      specs: {
        Amperi: '74 Ah',
        'Amperi za hladno pokretanje': '680 A',
        ETN: '574013068',
        'Kratki kod': 'E12',
        Napon: '12 V',
        'Dimenzije (D/Š/V)': '278/175/190',
        'Veličina kućišta': 'H6R/L3R',
        Tehnologija: 'SLI',
      },
      images: [
        'https://storage.data-varta-automotive.com/resources/images/v20200101/batteries/574013068k262.png',
        'https://storage.data-varta-automotive.com/resources/images/v20200101/batteries/574013068k262_1.png',
        'https://storage.data-varta-automotive.com/resources/images/v20200101/batteries/574013068k262_2.png',
        'https://storage.data-varta-automotive.com/resources/images/v20200101/batteries/574013068k262_3.png',
      ],
    });
    expect(article.description).not.toMatch(/DYNAMIC SLI 574013068|\u200b/u);
  });

  it('reads a page without a description', () => {
    const article = supplierArticleSchema.parse(
      varta.parse(page('8032510008882.html.gz')),
    );
    expect(article).toMatchObject({
      article_id: '8032510008882',
      number: '803251000',
      name: 'RED TOP 803251000',
      specs: {
        'Kratki kod': 'RT R 4,2',
        'Veličina kućišta': '34R (BCI)',
      },
    });
    expect(article).not.toHaveProperty('description');
    expect(article.specs).not.toHaveProperty('Tehnologija');
    expect(article.images).toHaveLength(4);
  });

  it('reads the technology off the product line name', () => {
    const html = page('574013068k262.html.gz').replaceAll(
      'DYNAMIC SLI 574013068',
      'SILVER DYNAMIC AGM 574013068',
    );
    expect(varta.parse(html)?.specs).toMatchObject({ Tehnologija: 'AGM' });
  });

  it('reads nothing from a page that is not a product', () => {
    expect(varta.parse('<html><body><main></main></body></html>')).toBe(null);
  });
});
