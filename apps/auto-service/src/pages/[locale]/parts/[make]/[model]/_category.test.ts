import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@podbor/catalog-contract';
import { content } from '@/i18n/content';
import { partPage, render, setShop } from '@/components/renderAstro';
import type { ModelHubEntry } from '@/utils/catalogueSnapshot';
import ModelCategoryPage from './[category].astro';

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

const model = {
  slug: 'f30-320d',
  name: '320d',
  chassis: {
    code: 'F30',
    body_style: 'sedan',
    series: {
      name: '3 серия',
      translations: null,
      make: { slug: 'bmw', name: 'BMW' },
    },
  },
} as unknown as ModelHubEntry['model'];

const bmw = { name: 'BMW', slug: 'bmw' };
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
  }),
];

const modelCategory = () => {
  setShop(true);
  return render(ModelCategoryPage, {
    path: '/ru/parts/bmw/f30-320d/oil-filters/',
    params: {
      locale: 'ru',
      make: 'bmw',
      model: 'f30-320d',
      category: 'oil-filters',
    },
    props: {
      hub: {
        make: bmw,
        model,
        vehicles: [],
        categories: [],
      },
      entry: {
        category: oilFilters,
        parts: [{ part: numbers[0].part, pages: numbers, fits: [] }],
      },
      pages: {
        makes: new Set(),
        models: new Set(),
        categories: new Set(),
        vehicles: new Set(),
      },
    },
  });
};

describe('the Model category page', () => {
  it('counts the current numbers, the unit the filtered search lists', async () => {
    const page = await modelCategory();

    expect(page.textContent).toContain(copy.found.replace('{count}', '2'));
    expect(
      page
        .querySelector('filter-sheet button[type="submit"]')
        ?.textContent?.trim(),
    ).toBe(copy.showResults.replace('{count}', '2'));
  });

  it('tallies the brand facet over the same numbers', async () => {
    const page = await modelCategory();
    const count = (value: string) =>
      page
        .querySelector(`input[value="${value}"]`)
        ?.closest('label')
        ?.querySelector('[data-facet-count]')?.textContent;

    expect(count('brand:bmw')).toBe('1');
    expect(count('brand:mann')).toBe('1');
  });
});
