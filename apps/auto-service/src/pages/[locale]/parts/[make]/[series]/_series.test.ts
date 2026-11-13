import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@podbor/catalog-contract';
import { content } from '@/i18n/content';
import { partPage, render, setShop } from '@/components/renderAstro';
import type {
  PartPageEntry,
  SeriesHubEntry,
  SeriesModel,
} from '@/utils/catalogueSnapshot';
import SeriesPage from './index.astro';

const copy = content('ru').partsSearch;
const hubCopy = content('ru').partsCar.hubs.model;

const oilFilters = {
  id: 'category_oil',
  slug: 'oil-filters',
  name: 'Масляные фильтры',
  text: '',
  translations: null,
  fields: [],
} as unknown as Category;

const make = { slug: 'bmw', name: 'BMW' };
const series = {
  name: '3 Series',
  slug: '3-series',
  translations: null,
  make,
} as SeriesHubEntry['series'];

const f30 = {
  model: {
    slug: 'f30-320d',
    name: '320d',
    chassis: { code: 'F30', body_style: 'sedan', series },
  },
  vehicles: [
    {
      id: 'veh_1',
      engine: { code: 'B47D20' },
      power_kw: 140,
      year_from: 2015,
      year_to: 2019,
    },
  ],
} as unknown as SeriesModel;

const demanded = (id: string) =>
  partPage({
    id,
    slug: `mann-${id}`,
    value: id,
    demand: { score: 6, popular: true, top: false },
    part: { ...partPage().part, id: `part_${id}` },
  });

const seriesPage = (pages: PartPageEntry[], models: SeriesModel[] = []) => {
  setShop(false);
  return render(SeriesPage, {
    path: '/ru/parts/bmw/3-series/',
    params: { locale: 'ru', make: 'bmw', series: '3-series' },
    props: {
      hub: {
        make,
        series,
        models,
        categories: [
          {
            category: oilFilters,
            parts: pages.map((page) => ({
              part: page.part,
              pages: [page],
              fits: [],
            })),
          },
        ],
      },
    },
  });
};

const headings = (root: Element) =>
  [...root.querySelectorAll('h2')].map((heading) =>
    heading.textContent?.trim(),
  );

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the Series page', () => {
  it('links each category of the Series to its page', async () => {
    const root = await seriesPage([partPage()]);

    expect(
      root.querySelector('a[href="/ru/parts/bmw/3-series/oil-filters/"]'),
    ).not.toBeNull();
  });

  it('lists each modification as a link into the parts search scoped to it', async () => {
    const root = await seriesPage([partPage()], [f30]);
    const link = root.querySelector<HTMLAnchorElement>(
      'a[href="/ru/parts/search/?make=bmw&model=f30-320d"]',
    );

    expect(headings(root)).toContain(hubCopy.carsHeading);
    expect(link?.textContent).toContain('3 Series F30 320d');
    expect(link?.textContent).toContain('B47D20');
  });

  it('shows no modifications block while the Series lists none', async () => {
    const root = await seriesPage([partPage()]);

    expect(headings(root)).not.toContain(hubCopy.carsHeading);
  });
});

describe('demand on the Series page', () => {
  it('names the Series over what is often ordered for it', async () => {
    const root = await seriesPage([demanded('a'), demanded('b')]);

    expect(headings(root)).toContain(
      copy.popularForCar.replace('{car}', 'BMW 3 Series'),
    );
  });

  it('shows no block while only one part fitting the Series is popular', async () => {
    const root = await seriesPage([demanded('a'), partPage()]);

    expect(
      headings(root).some((heading) =>
        heading?.startsWith(copy.popularHeading),
      ),
    ).toBe(false);
  });
});
