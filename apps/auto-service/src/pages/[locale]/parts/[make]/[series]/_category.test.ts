import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@podbor/catalog-contract';
import { content } from '@/i18n/content';
import { isOrange, partPage, render, setShop } from '@/components/renderAstro';
import type { SeriesHubEntry } from '@/utils/catalogueSnapshot';
import SeriesCategoryPage from './[category].astro';

const copy = content('ru').partsSearch;

afterEach(() => {
  vi.unstubAllEnvs();
});

const oilFilters = {
  id: 'category_oil',
  slug: 'oil-filters',
  name: 'Масляные фильтры',
  text: 'Фильтр.',
  translations: null,
  fields: [],
} as unknown as Category;

const bmw = { name: 'BMW', slug: 'bmw' };
const series = {
  name: '3 Series',
  slug: '3-series',
  translations: null,
  make: bmw,
} as SeriesHubEntry['series'];

const numbers = [
  partPage({ id: 'pi_bmw', slug: 'bmw-11428507683', brand: bmw }),
  partPage({
    id: 'pi_bmw_old',
    slug: 'bmw-11427953125',
    superseded: true,
    brand: bmw,
  }),
  partPage({
    id: 'pi_mann',
    slug: 'mann-hu816x',
    brand: { name: 'MANN', slug: 'mann' },
    demand: { score: 3, popular: false, top: false },
  }),
];

const seriesCategory = () => {
  setShop(true);
  return render(SeriesCategoryPage, {
    path: '/ru/parts/bmw/3-series/oil-filters/',
    params: {
      locale: 'ru',
      make: 'bmw',
      series: '3-series',
      category: 'oil-filters',
    },
    props: {
      hub: { make: bmw, series, models: [], categories: [] },
      entry: {
        category: oilFilters,
        parts: [{ part: numbers[0].part, pages: numbers, fits: [] }],
      },
    },
  });
};

describe('the Series category page', () => {
  it('links the whole category in ink, not orange', async () => {
    const page = await seriesCategory();
    const link = [...page.querySelectorAll('a')].find(
      (anchor) =>
        anchor.textContent?.trim() === content('ru').shopPart.categoryLink,
    )!;

    expect(link.getAttribute('href')).toBe('/ru/parts/c/oil-filters/');
    expect(isOrange(link)).toBe(false);
  });

  it('walks back up through the Series page', async () => {
    const page = await seriesCategory();

    expect(
      page.querySelector('a[href="/ru/parts/bmw/3-series/"]'),
    ).not.toBeNull();
  });

  it('counts the current numbers and says so', async () => {
    const page = await seriesCategory();

    expect(page.textContent).toContain(
      copy.foundNumbers.replace('{count}', '2'),
    );
  });

  it('offers no filters that would leave the Series for the whole category', async () => {
    const page = await seriesCategory();

    expect(page.querySelector('filter-sheet')).toBeNull();
    expect(page.querySelector('nav[aria-label="Порядок"]')).toBeNull();
  });
});
