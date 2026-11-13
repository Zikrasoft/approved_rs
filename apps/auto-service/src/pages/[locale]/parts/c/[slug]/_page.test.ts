import { afterEach, describe, expect, it, vi } from 'vitest';
import { orangeIn, partPage, render, setShop } from '@/components/renderAstro';
import type { CategoryCar } from '@/utils/categoryCars';
import type { PartPageEntry } from '@/utils/catalogueSnapshot';
import CategoryPage from './[...page].astro';

afterEach(() => {
  vi.unstubAllEnvs();
});

const category = {
  id: 'cat_batteries',
  slug: 'batteries',
  name: 'Аккумуляторы',
  text: 'Стартерные аккумуляторы.',
  translations: null,
  maintenance_kit: false,
  kit_rank: 0,
  service_label: null,
  service_price: null,
  service_note: null,
  installation_price: null,
  image: null,
  fields: [],
};

const bmw = { slug: 'bmw', name: 'BMW' };
const mercedes = { slug: 'mercedes-benz', name: 'Mercedes-Benz' };

const cars = [
  {
    make: bmw,
    series: [{ name: '3 серия', slug: '3-series', translations: null }],
  },
  {
    make: mercedes,
    series: [
      {
        name: 'E-Класс',
        slug: 'e-class',
        translations: { en: { name: 'E-Class' } },
      },
    ],
  },
] as unknown as CategoryCar[];

const categoryPage = (pages: PartPageEntry[], offered: CategoryCar[]) => {
  setShop(true);
  return render(CategoryPage, {
    path: '/ru/parts/c/batteries/',
    params: { locale: 'ru', slug: 'batteries' },
    props: {
      category: { ...category, pages },
      listing: { number: 1, count: 1, pages },
      cars: offered,
    },
  });
};

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

describe('the car picker on a category page', () => {
  it('offers the makes and their series that have a page in the category', async () => {
    const doc = await categoryPage([partPage()], cars);
    const picker = doc.querySelector('car-picker')!;
    expect(text(picker.querySelector('h2'))).toBe('Для моего авто');
    expect(picker.getAttribute('data-href')).toBe(
      '/ru/parts/{make}/{series}/batteries/',
    );
    expect(
      [...picker.querySelectorAll('[name=make] option')].map((option) => [
        option.getAttribute('value'),
        text(option),
      ]),
    ).toEqual([
      ['', 'Любая марка'],
      ['bmw', 'BMW'],
      ['mercedes-benz', 'Mercedes-Benz'],
    ]);
    expect(
      [...picker.querySelectorAll('[name=series] optgroup')].map((group) => [
        group.getAttribute('data-make'),
        [...group.querySelectorAll('option')].map((option) => [
          option.getAttribute('value'),
          text(option),
        ]),
      ]),
    ).toEqual([
      ['bmw', [['3-series', '3 серия']]],
      ['mercedes-benz', [['e-class', 'E-Класс']]],
    ]);
  });

  it('falls back to the category search without JavaScript', async () => {
    const doc = await categoryPage([partPage()], cars);
    const form = doc.querySelector('car-picker form')!;
    expect(form.getAttribute('action')).toBe('/ru/parts/search/');
    expect(form.getAttribute('method')).toBe('GET');
    expect(
      form.querySelector('input[name=category]')?.getAttribute('value'),
    ).toBe('batteries');
    expect(form.querySelector('[name=series]')?.hasAttribute('required')).toBe(
      true,
    );
  });

  it('leaves the orange to the contact actions, since it only filters', async () => {
    const doc = await categoryPage([partPage()], cars);
    expect(orangeIn(doc.querySelector('car-picker')!)).toEqual([]);
  });

  it('is left out when no series has a page in the category', async () => {
    const doc = await categoryPage([partPage()], []);
    expect(doc.querySelector('car-picker')).toBeNull();
  });

  it('is left out of an empty category', async () => {
    const doc = await categoryPage([], cars);
    expect(doc.querySelector('car-picker')).toBeNull();
  });
});

describe('an empty category', () => {
  it('ends on the inquiry card without a full band of padding under it', async () => {
    const doc = await categoryPage([], cars);
    const section = doc.querySelector('#inquiry')!.parentElement!;
    expect(section.classList).not.toContain('pb-band');
    expect(section.classList).not.toContain('md:py-band-lg');
  });
});

describe('demand on a category page', () => {
  const demanded = (id: string, score: number, top: boolean) =>
    partPage({
      id,
      slug: `bosch-${id}`,
      value: id,
      demand: { score, popular: true, top },
      part: { ...partPage().part, id: `part_${id}` },
    });
  const headings = (doc: Element) =>
    [...doc.querySelectorAll('h2')].map((heading) => text(heading));

  it('shows what is often ordered in the category and badges its top parts', async () => {
    const doc = await categoryPage(
      [demanded('a', 6, false), demanded('b', 9, true)],
      [],
    );

    expect(headings(doc)).toContain('Часто заказывают');
    expect(doc.querySelectorAll('[data-demand-badge]').length).toBeGreaterThan(
      0,
    );
  });

  it('shows no block for a single popular part', async () => {
    const doc = await categoryPage([demanded('a', 6, false), partPage()], []);

    expect(headings(doc)).not.toContain('Часто заказывают');
  });

  it('offers the popular order on the search beside its own', async () => {
    const doc = await categoryPage([partPage(), demanded('a', 6, false)], []);
    const orders = [...doc.querySelectorAll('nav[aria-label="Порядок"] a')].map(
      (link) => [link.getAttribute('href'), link.getAttribute('aria-current')],
    );

    expect(orders).toEqual([
      ['/ru/parts/c/batteries/', 'page'],
      ['/ru/parts/search/?category=batteries&sort=popular', null],
    ]);
  });

  it('offers no popular order while nothing in the category is demanded', async () => {
    const doc = await categoryPage(
      [partPage(), partPage({ id: 'pi_ate', slug: 'ate-1' })],
      [],
    );

    expect(doc.querySelector('nav[aria-label="Порядок"]')).toBeNull();
  });
});
