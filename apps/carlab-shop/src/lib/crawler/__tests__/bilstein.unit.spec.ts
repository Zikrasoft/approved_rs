import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { supplierArticleSchema } from '../../suppliers/adapter';
import { sitemapLinks } from '../sitemap';
import { bilstein } from '../sites/bilstein';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', 'bilstein', name));
const page = (name: string) => gunzipSync(fixture(name)).toString('utf8');

describe('bilstein group partsfinder', () => {
  it('seeds only febi, SWAG and Blue Print pages of the families the catalogue covers', () => {
    const { pages } = sitemapLinks(
      fixture('sr-sitemap-1.xml'),
      bilstein.sitemapPage,
    );
    expect(pages.filter(bilstein.isPage)).toEqual([
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

  it('renders article pages in the browser and opens their vehicle list first', () => {
    expect(bilstein.fetchMode).toBe('browser');
    expect(bilstein.waitFor).toBe('#detail-page-applications');
    expect(bilstein.interact).toBeDefined();
  });

  it('reads a febi brake disc with its criteria, OE numbers, images and vehicles', () => {
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
      specs: {
        'Strana ugradnje': 'zadnja osovina',
        'Broj rupa felge': '6',
        'Broj rupa za fiksiranje': '1',
        'Debljina diska kočnice': '16,3 mm',
        'Minimalna debljina disk kočnice': '14 mm',
        površina: 'prevuceno slojem',
        'Prečnik otvora': '130 mm',
        'Promer centriranja': '85 mm',
        'Spoljni presek': '298 mm',
        'visina ili debljina': '71,4 mm',
        'Vrsta kočionog diska': 'puno',
      },
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
      vehicles: expect.any(Array),
    });
    expect(article.vehicles).toHaveLength(204);
    expect(article.vehicles?.[0]).toEqual({
      make: 'Dodge',
      model: 'Sprinter I',
      variant: '2.7 CDI V6 24V',
      chassis_codes: ['VA'],
      engine_codes: ['EX9'],
      displacement_cc: 2688,
      power_kw: 113,
      fuel: 'diesel',
      body_style: 'van',
      year_from: 2002,
      year_to: 2006,
      notes: [],
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
        materijal: 'Celicni liv',
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
      vehicles: expect.any(Array),
    });
    expect(article.vehicles).toHaveLength(54);
    expect(article.vehicles).toContainEqual(
      expect.objectContaining({
        make: 'BMW',
        model: '3',
        chassis_codes: ['E36'],
        engine_codes: ['M52'],
      }),
    );
  });

  it('reads a Blue Print oil filter with the limits of each vehicle it fits', () => {
    const article = supplierArticleSchema.parse(
      bilstein.parse(page('blueprint-ada102116.html.gz')),
    );
    expect(article).toMatchObject({
      article_id: 'blueprint/ADA102116',
      brand: 'Blue Print',
      number: 'ADA102116',
      name: 'uljni filter sa zaptivnim prstenom',
      specs: {
        'izgled filtera': 'uložak filtera',
        'Prečnik zaptivnog prstena': '77 mm',
        'Spoljni presek': '72 mm',
        'Unutrašnji prečnik': '25,5 mm',
        Visina: '143 mm',
      },
      images: [
        'https://cdn.partsfinder.bilsteingroup.com/pf-article-zoomed/2/ADA102116_1.jpg',
        'https://cdn.partsfinder.bilsteingroup.com/pf-article-zoomed/2/ADA102116_2.jpg',
      ],
    });
    expect(article.vehicles).toHaveLength(7);
    expect(article.vehicles?.[0]).toEqual({
      make: 'Dodge',
      model: 'Nitro',
      variant: '2.8 CRD 16V',
      chassis_codes: ['KA'],
      engine_codes: ['ENS'],
      displacement_cc: 2777,
      power_kw: 130,
      fuel: 'diesel',
      body_style: null,
      year_from: 2006,
      year_to: 2012,
      notes: [],
    });
    expect(article.vehicles).toContainEqual(
      expect.objectContaining({
        model: 'Wrangler III 4x4',
        chassis_codes: ['JK'],
        year_from: 2006,
        year_to: null,
      }),
    );
    expect(article.cross_references).toHaveLength(8);
    expect(article.cross_references?.[7]).toEqual({
      brand: 'Jeep',
      number: 'K68032204AA',
    });
  });

  it('keeps a ball joint whose name goes on past the word kugla, not a ball bearing', () => {
    const named = (name: string) =>
      bilstein.parse(
        page('febi-27699.html.gz').replace(
          '27699 | kočioni disk |',
          `27699 | ${name} |`,
        ),
      )?.name ?? null;
    const ballJoint =
      'kugla sa krunastom navrtkom, rascepkom i sigurnosnim prstenom';
    expect(named(ballJoint)).toBe(ballJoint);
    expect(named('kugla')).toBe('kugla');
    expect(named('kuglasti ležaj')).toBe(null);
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
