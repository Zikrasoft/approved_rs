import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import {
  isOrange,
  orangeIn,
  partPage,
  render,
  setShop,
} from '@/components/renderAstro';
import PartsHub from './index.astro';

const copy = content('ru').pages.partsInquiry;

const category = (slug: string, empty: boolean, demand = 0) => ({
  id: `category_${slug}`,
  slug,
  name: slug,
  text: `${slug} lead.`,
  translations: null,
  maintenance_kit: false,
  kit_rank: 0,
  service_label: null,
  service_price: null,
  service_note: null,
  installation_price: null,
  image: null,
  fields: [],
  empty,
  demand,
});

const hub = (
  categories = [category('batteries', false), category('wipers', true)],
) =>
  render(PartsHub, {
    path: '/ru/parts/',
    params: { locale: 'ru' },
    props: { categories, makes: [] },
  });

const tileOrder = (root: Element) =>
  [...root.querySelectorAll('a.card h3')].map((title) => title.textContent);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the parts hub', () => {
  it('opens an inquiry for a category with no parts yet and browses one with parts', async () => {
    setShop(false);
    const root = await hub();
    const tile = (slug: string) =>
      [...root.querySelectorAll('a.card')].find((link) =>
        link.getAttribute('href')?.startsWith(`/ru/parts/c/${slug}/`),
      );

    expect(tile('wipers')?.getAttribute('href')).toBe(
      '/ru/parts/c/wipers/#inquiry',
    );
    expect(tile('wipers')?.textContent).toContain(copy.categoryOrderCta);
    expect(tile('batteries')?.getAttribute('href')).toBe(
      '/ru/parts/c/batteries/',
    );
    expect(tile('batteries')?.textContent).toContain(copy.categoryCta);
    expect(tile('batteries')?.textContent).toContain('batteries lead.');
  });

  it('keeps its links in ink so the inquiry stays the one orange action', async () => {
    setShop(false);
    const root = await render(PartsHub, {
      path: '/ru/parts/',
      params: { locale: 'ru' },
      props: {
        categories: [category('batteries', false), category('wipers', true)],
        makes: [{ slug: 'bmw', name: 'BMW' }],
      },
    });
    const links = [
      ...root.querySelectorAll('a.card'),
      root.querySelector('a[href="/ru/parts/makes/"]')!,
      root.querySelector('cart-badge a')!,
    ];

    expect(links.flatMap(orangeIn)).toEqual([]);
    expect(
      links.filter(isOrange).map((link) => link.getAttribute('href')),
    ).toEqual([]);
  });

  it('keeps the cart link for preview only while the shop is closed', async () => {
    setShop(false);
    const root = await hub();

    expect(
      root
        .querySelector('cart-badge[data-reveal-when-filled]')
        ?.hasAttribute('data-preview-only'),
    ).toBe(true);
  });

  it('shows the cart link to everyone once the shop is open', async () => {
    setShop(true);
    const root = await hub();

    expect(
      root
        .querySelector('cart-badge[data-reveal-when-filled]')
        ?.hasAttribute('data-preview-only'),
    ).toBe(false);
  });

  it('lists the most demanded categories first', async () => {
    setShop(false);
    const root = await hub([
      category('batteries', false, 3),
      category('wipers', true),
      category('brakes', false, 11),
    ]);

    expect(tileOrder(root)).toEqual(['brakes', 'batteries', 'wipers']);
  });

  it('keeps the categories in their own order while nothing is demanded', async () => {
    setShop(false);
    const root = await hub([
      category('wipers', true),
      category('batteries', false),
      category('brakes', false),
    ]);

    expect(tileOrder(root)).toEqual(['wipers', 'batteries', 'brakes']);
  });

  it('leaves the popular parts to the showcase instead of a second list', async () => {
    setShop(false);
    const root = await hub();

    expect(
      [...root.querySelectorAll('h2')].map((title) =>
        title.textContent?.trim(),
      ),
    ).not.toContain(content('ru').partsSearch.popularHeading);
  });

  describe('the showcase of every part', () => {
    const listed = (count: number) => ({
      results: [
        {
          id: 'pi_hu1',
          type: 'manufacturer-number',
          value: 'HU 1',
          normalized_value: 'HU1',
          superseded: false,
          brand: { name: 'Mann-Filter', slug: 'mann-filter' },
          part: { id: 'part_hu1', name: 'Масляный фильтр', category: null },
          offers: [],
          thumbnail: null,
        },
      ],
      facets: [],
      category: null,
      model: null,
      count,
      offset: 0,
      limit: 12,
    });
    const empty = { ...listed(0), results: [] };
    const searchCopy = content('ru').partsSearch;

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const showcase = async (count: number) => {
      vi.stubEnv('MEDUSA_BACKEND_URL', 'http://shop.test');
      vi.stubEnv('MEDUSA_PUBLISHABLE_KEY', 'pk_test');
      setShop(false);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json(count ? listed(count) : empty)),
      );
      return (await hub()).querySelector('parts-browse');
    };

    it('opens the hub with the first page of the catalogue and a link to the next', async () => {
      const root = await showcase(30);

      expect(root?.querySelector('h2')?.textContent?.trim()).toBe(
        searchCopy.allHeading,
      );
      expect(
        root?.querySelector('[data-parts-browse] li a')?.getAttribute('href'),
      ).toBe('/ru/parts/p/mann-filter-hu1/');
      expect(root?.querySelector('a[rel="next"]')?.getAttribute('href')).toBe(
        '/ru/parts/search/?offset=12',
      );
      expect(root?.querySelector('a[rel="prev"]')).toBeNull();
      expect(root?.querySelector('[aria-live]')).not.toBeNull();
      expect(root?.getAttribute('data-parts-browse-source')).toBe(
        '/ru/parts/search/',
      );
    });

    it('draws no pager when the catalogue fits on one page', async () => {
      expect((await showcase(1))?.querySelector('nav')).toBeNull();
    });

    it('shows nothing for an empty catalogue or without a shop', async () => {
      expect(await showcase(0)).toBeNull();
      vi.unstubAllEnvs();
      expect((await hub()).querySelector('parts-browse')).toBeNull();
    });
  });
});
