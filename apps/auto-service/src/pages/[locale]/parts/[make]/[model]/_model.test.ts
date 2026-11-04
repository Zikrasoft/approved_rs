import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@podbor/catalog-contract';
import { content } from '@/i18n/content';
import { partPage, render, setShop } from '@/components/renderAstro';
import { carName } from '@/utils/carName';
import type { ModelHubEntry, PartPageEntry } from '@/utils/catalogueSnapshot';
import ModelPage from './index.astro';

const copy = content('ru').partsSearch;

const oilFilters = {
  id: 'category_oil',
  slug: 'oil-filters',
  name: 'Масляные фильтры',
  text: '',
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

const demanded = (id: string) =>
  partPage({
    id,
    slug: `mann-${id}`,
    value: id,
    demand: { score: 6, popular: true, top: false },
    part: { ...partPage().part, id: `part_${id}` },
  });

const modelPage = (pages: PartPageEntry[]) => {
  setShop(false);
  return render(ModelPage, {
    path: '/ru/parts/bmw/f30-320d/',
    params: { locale: 'ru', make: 'bmw', model: 'f30-320d' },
    props: {
      hub: {
        make: { slug: 'bmw', name: 'BMW' },
        model,
        vehicles: [],
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
      pages: {
        makes: new Set(),
        models: new Set(),
        categories: new Set(),
        vehicles: new Set(),
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

describe('demand on the Model page', () => {
  it('names the Model over what is often ordered for it', async () => {
    const root = await modelPage([demanded('a'), demanded('b')]);

    expect(headings(root)).toContain(
      copy.popularForCar.replace('{car}', carName(model, 'ru')),
    );
  });

  it('shows no block while only one part fitting the Model is popular', async () => {
    const root = await modelPage([demanded('a'), partPage()]);

    expect(
      headings(root).some((heading) =>
        heading?.startsWith(copy.popularHeading),
      ),
    ).toBe(false);
  });
});
