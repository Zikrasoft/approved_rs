import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { supplierArticleSchema } from '../../suppliers/adapter';
import { bilstein } from '../sites/bilstein';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', 'bilstein', name));
const page = (name: string) => gunzipSync(fixture(name)).toString('utf8');

describe('bilstein group partsfinder', () => {
  it('seeds only febi, SWAG and Blue Print pages of the families the catalogue covers', () => {
    const xml = fixture('sr-sitemap-1.xml').toString('utf8');
    expect(bilstein.sitemapPages?.(xml).filter(bilstein.isPage)).toEqual([
      'https://partsfinder.bilsteingroup.com/sr/article/febi/27699',
      'https://partsfinder.bilsteingroup.com/sr/article/SWAG/20%2092%201466',
      'https://partsfinder.bilsteingroup.com/sr/article/blueprint/ADA102116',
      'https://partsfinder.bilsteingroup.com/sr/article/febi/01934',
    ]);
    expect(bilstein.sitemaps).toEqual([
      'https://partsfinder.bilsteingroup.com/sitemaps/sr/sitemap-index.xml',
    ]);
    expect(bilstein.floorMs).toBe(5000);
    expect(
      bilstein.isPage(
        'https://partsfinder.bilsteingroup.com/en/article/febi/27699',
      ),
    ).toBe(false);
    expect(
      bilstein.isPage(
        'https://partsfinder.bilsteingroup.com/sr/article/thyssenkrupp/24-287487',
      ),
    ).toBe(false);
  });

  it('reads a febi brake disc with its criterion, OE numbers and images', () => {
    const article = supplierArticleSchema.parse(
      bilstein.parse(page('febi-27699.html.gz')),
    );
    expect(article).toEqual({
      article_id: 'febi/27699',
      brand: 'febi',
      number: '27699',
      name: 'kočioni disk',
      category: 'kočioni disk',
      description:
        'Kombinacija performansi, udobnosti vožnje i izdržljivosti; Udobnost: Bez škrgetanja kočnica, bez vibracija; Bezbednost: Optimalna efikasnost kočenja, kratke udaljenosti kočenja; Niskobučan: najsavremeniji metodi smanjenja buke',
      specs: { 'Strana ugradnje': 'zadnja osovina' },
      cross_references: [
        { brand: 'Dodge', number: '68013764AA' },
        { brand: 'Mercedes-Benz', number: '906 423 00 12' },
        { brand: 'Mercedes-Benz', number: '910 423 00 00 07' },
        { brand: 'Mercedes-Benz', number: '910 423 00 00' },
        { brand: 'Mercedes-Benz', number: '910 423 01 00' },
        { brand: 'Volkswagen (VW)', number: '2E0 615 601 A' },
      ],
      images: [
        'https://cdn.partsfinder.bilsteingroup.com/pf-article-zoomed/1/27699_1.jpg',
        'https://cdn.partsfinder.bilsteingroup.com/pf-article-zoomed/1/27699_2.jpg',
        'https://cdn.partsfinder.bilsteingroup.com/pf-article-zoomed/1/27699_3.jpg',
      ],
    });
  });

  it('reads a SWAG control arm with the contents of its set', () => {
    const article = supplierArticleSchema.parse(
      bilstein.parse(page('swag-20-92-1466.html.gz')),
    );
    expect(article).toEqual({
      article_id: 'SWAG/20 92 1466',
      brand: 'SWAG',
      number: '20 92 1466',
      name: 'rame sa ležištem, zglobom, držačem i sigurnosnom navrtkom',
      category: 'rame sa ležištem, zglobom, držačem i sigurnosnom navrtkom',
      specs: {
        'Strana ugradnje': 'prednja osovina dole, levo',
        'Sadržaj seta':
          '1 x 20 73 0036 rame bez ležaja, sa zglobom i sigurnosnom navrtkom; 1 x 20 92 1463 nosač ramena sa držačem',
      },
      cross_references: [
        { brand: 'BMW', number: '31 12 6 758 513 S1' },
        { brand: 'BMW', number: '31 12 1 094 275' },
      ],
      images: [
        'https://cdn.partsfinder.bilsteingroup.com/pf-article-zoomed/3/20%2092%201466_1.jpg',
      ],
    });
  });

  it('reads a Blue Print oil filter that lists no criteria', () => {
    const article = supplierArticleSchema.parse(
      bilstein.parse(page('blueprint-ada102116.html.gz')),
    );
    expect(article).toMatchObject({
      article_id: 'blueprint/ADA102116',
      brand: 'Blue Print',
      number: 'ADA102116',
      name: 'uljni filter sa zaptivnim prstenom',
      specs: {},
      images: [
        'https://cdn.partsfinder.bilsteingroup.com/pf-article-zoomed/2/ADA102116_1.jpg',
        'https://cdn.partsfinder.bilsteingroup.com/pf-article-zoomed/2/ADA102116_2.jpg',
      ],
    });
    expect(article.cross_references).toHaveLength(8);
    expect(article.cross_references?.[7]).toEqual({
      brand: 'Jeep',
      number: 'K68032204AA',
    });
  });

  it('skips an article outside the covered families and a page that is not an article', () => {
    const turbo = page('febi-27699.html.gz').replace(
      '27699 | kočioni disk |',
      '27699 | Turbo punjač |',
    );
    expect(bilstein.parse(turbo)).toBe(null);
    expect(bilstein.parse('<html><body><main></main></body></html>')).toBe(
      null,
    );
  });
});
