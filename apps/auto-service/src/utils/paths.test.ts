import { readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { RESERVED_PARTS_SEGMENTS } from '@podbor/catalog-contract';
import {
  catalogueLinks,
  PathBuilder,
  seriesPath,
  swapLocale,
  withLocales,
} from './paths';
import { SERVICE_SLUGS } from './services';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('seriesPath', () => {
  it.each(SUPPORTED_LOCALES)(
    'puts a %s Series page under its Make',
    (locale) => {
      expect(
        seriesPath(locale, { name: 'Polo V', make: { slug: 'volkswagen' } }),
      ).toBe(`/${locale}/parts/volkswagen/polo-v/`);
    },
  );
});

describe('PathBuilder.partsModelSearch', () => {
  it('scopes the search page to one Model', () => {
    expect(
      PathBuilder.partsModelSearch('sr', 'volkswagen', 'polo-v-6c-10'),
    ).toBe('/sr/parts/search/?make=volkswagen&model=polo-v-6c-10');
  });
});

describe('Make paths', () => {
  it('puts a Make page under /cars/ by the catalogue slug', () => {
    expect(PathBuilder.carsMake('sr', 'mercedes-benz')).toBe(
      '/sr/cars/mercedes-benz/',
    );
  });

  it('narrows the Works list to one Make', () => {
    expect(PathBuilder.worksOfMake('en', 'bmw')).toBe('/en/works/?make=bmw');
  });
});

describe('PathBuilder', () => {
  it('prefixes every path with the locale and ends with a slash', () => {
    const paths = [
      PathBuilder.home('sr'),
      PathBuilder.services('sr'),
      PathBuilder.service('sr', 'diagnostics'),
      PathBuilder.works('sr'),
      PathBuilder.work('sr', 'bmw-x5'),
      PathBuilder.contact('sr'),
      PathBuilder.thanks('sr'),
      PathBuilder.privacy('sr'),
      PathBuilder.about('sr'),
      PathBuilder.bmw('sr'),
    ];
    paths.forEach((path) => {
      expect(path.startsWith('/sr/')).toBe(true);
      expect(path.endsWith('/')).toBe(true);
    });
  });

  it('carries a part into the inquiry URL, so a no-JS Lead keeps it on its page', () => {
    expect(PathBuilder.partsInquiry('ru')).toBe('/ru/parts/#inquiry');
    expect(PathBuilder.partsInquiry('ru', 'VARTA 580901080')).toBe(
      '/ru/parts/?part=VARTA+580901080#inquiry',
    );
  });

  it.each(SERVICE_SLUGS)('builds a service URL for %s', (slug) => {
    expect(PathBuilder.service('ru', slug)).toBe(`/ru/services/${slug}/`);
  });

  it.each(SUPPORTED_LOCALES)(
    'puts a %s Category page past the first under its number',
    (locale) => {
      expect(PathBuilder.partsCategory(locale, 'oil-filters')).toBe(
        `/${locale}/parts/c/oil-filters/`,
      );
      expect(PathBuilder.partsCategory(locale, 'oil-filters', 1)).toBe(
        `/${locale}/parts/c/oil-filters/`,
      );
      expect(PathBuilder.partsCategory(locale, 'oil-filters', 2)).toBe(
        `/${locale}/parts/c/oil-filters/2/`,
      );
    },
  );

  it('puts the blog, its later pages, an Article and a Make page under their sections', () => {
    expect(PathBuilder.blog('sr')).toBe('/sr/blog/');
    expect(PathBuilder.blog('sr', 1)).toBe('/sr/blog/');
    expect(PathBuilder.blog('sr', 2)).toBe('/sr/blog/2/');
    expect(PathBuilder.blogArticle('sr', 'oil')).toBe('/sr/blog/oil/');
    expect(PathBuilder.carsMake('sr', 'bmw')).toBe('/sr/cars/bmw/');
  });
});

describe('swapLocale', () => {
  it('replaces the locale segment and keeps the rest of the path', () => {
    expect(swapLocale('/ru/works/bmw-x5/', 'en')).toBe('/en/works/bmw-x5/');
  });

  it('maps a bare locale root to the other locale root', () => {
    expect(swapLocale('/ru/', 'sr')).toBe('/sr/');
  });

  it('handles a path with no trailing slash', () => {
    expect(swapLocale('/ru/contact', 'en')).toBe('/en/contact/');
  });

  it('never produces a doubled locale prefix', () => {
    const swapped = swapLocale('/en/works/bmw/', 'ru');
    expect(swapped).toBe('/ru/works/bmw/');
    expect(swapped.split('/').filter(Boolean)[0]).toBe('ru');
  });
});

describe('withLocales', () => {
  it('fans one path set out across every supported locale', () => {
    const paths = withLocales([{ params: { slug: 'a' } }]);
    expect(paths).toHaveLength(SUPPORTED_LOCALES.length);
    expect(paths.map((p) => p.params.locale).sort()).toEqual(
      [...SUPPORTED_LOCALES].sort(),
    );
    paths.forEach((p) => expect(p.params.slug).toBe('a'));
  });
});

describe('reserved parts segments', () => {
  const reserved: readonly string[] = RESERVED_PARTS_SEGMENTS;

  it('reserves every section page under /parts/ a Make slug could shadow', () => {
    const sections = readdirSync(
      new URL('../pages/[locale]/parts/', import.meta.url),
    )
      .map((entry) => entry.replace(/\.astro$/, ''))
      .filter((entry) => entry !== 'index' && !/^[_[]/.test(entry));
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.filter((entry) => !reserved.includes(entry))).toEqual([]);
  });

  it('reserves every fixed segment a PathBuilder link puts under /parts/', () => {
    const segments = Object.values(PathBuilder)
      .map((build) =>
        (build as (...args: string[]) => string)('sr', '$a', '$b', '$c', '$d'),
      )
      .filter((path) => path.startsWith('/sr/parts/'))
      .map((path) => path.split('/')[3])
      .filter((segment) => segment && !/^[$#?]/.test(segment));
    expect(segments).toContain('makes');
    expect(segments.filter((segment) => !reserved.includes(segment))).toEqual(
      [],
    );
  });
});

describe('catalogueLinks', () => {
  const series = { name: '3 Series', make: { slug: 'bmw' } };
  const links = catalogueLinks('ru', {
    makes: new Set(['bmw']),
    series: new Set(['bmw/3-series']),
    categories: new Set(['bmw/3-series/brake-pads']),
  });

  it('links a Series that has a page', () => {
    expect(links.series(series)).toBe('/ru/parts/bmw/3-series/');
    expect(links.series({ ...series, name: '5 Series' })).toBeNull();
  });

  it('links a category the Series has a page for', () => {
    expect(links.seriesCategory(series, 'brake-pads')).toBe(
      '/ru/parts/bmw/3-series/brake-pads/',
    );
  });

  it('gives nothing for a category without a Series page', () => {
    expect(links.seriesCategory(series, 'oil-filters')).toBeNull();
  });
});
