import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/i18n/content';
import {
  isOrange,
  orangeIn,
  render,
  respond,
  setShop,
} from '@/components/renderAstro';
import { categoriesForBuild, pageListForBuild } from '@/utils/catalogueEnv';
import type { Category } from '@podbor/catalog-contract';
import { FILTERS_INQUIRY_ATTRIBUTE } from '@/scripts/filterSheet';
import { partsHubOf, type PartsHub as HubData } from '@/utils/partsHub';
import PartsHub from './index.astro';

const built = vi.hoisted(() => ({ makes: [], categories: [] }) as HubData);

vi.mock('virtual:parts-hub', () => ({ default: built }));

vi.mock('@/utils/catalogueEnv', async (original) => {
  const snapshot = async () => {
    throw new Error('the catalogue is read at request time');
  };
  const actual = await original<typeof import('@/utils/catalogueEnv')>();
  return {
    ...actual,
    ...Object.fromEntries(
      Object.keys(actual)
        .filter((name) => name.endsWith('ForBuild'))
        .map((name) => [name, vi.fn(snapshot)]),
    ),
  };
});

const copy = content('ru').pages.partsInquiry;

type Entry = { category: Category; listed: number; demand: number | null };

const category = (
  slug: string,
  empty: boolean,
  listed = 1,
  demand: number | null = null,
): Entry => ({
  category: {
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
  },
  listed: empty ? 0 : listed,
  demand,
});

type HubMake = { slug: string; name: string; hub: boolean; parts: number };

const hub = (
  entries = [category('batteries', false), category('wipers', true)],
  makes: HubMake[] = [],
  path = '/ru/parts/',
) => {
  Object.assign(
    built,
    partsHubOf(
      entries.map((entry) => entry.category),
      {
        parts: [],
        makes,
        series: [],
        categories: entries.map(({ category: own, listed, demand }) => ({
          slug: own.slug,
          name: own.name,
          listed,
          demand,
        })),
        catalogue_makes: null,
      },
    ),
  );
  return render(PartsHub, { path, params: { locale: 'ru' } });
};

const tileOrder = (root: Element) =>
  [...root.querySelectorAll('a.card h3')].map((title) => title.textContent);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the parts hub', () => {
  it('never reads the catalogue at build time while it answers a visitor', async () => {
    setShop(false);
    const root = await hub();

    expect(
      root.querySelector('a[href="/ru/parts/c/batteries/"]'),
    ).not.toBeNull();
    expect(categoriesForBuild).not.toHaveBeenCalled();
    expect(pageListForBuild).not.toHaveBeenCalled();
  });

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
    const root = await hub(undefined, [
      { slug: 'bmw', name: 'BMW', hub: true, parts: 3 },
    ]);
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

  it('lists the most demanded categories first, not the biggest', async () => {
    setShop(false);
    const root = await hub([
      category('batteries', false, 3, 5),
      category('wipers', true),
      category('brakes', false, 11, 2),
    ]);

    expect(tileOrder(root)).toEqual(['batteries', 'brakes', 'wipers']);
  });

  it('keeps the categories in their own order while their counts are equal', async () => {
    setShop(false);
    const root = await hub([
      category('wipers', false),
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
    const listed = (count: number, offset = 0) => ({
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
          demand: { score: 3, popular: true, top: false },
        },
      ],
      facets: [
        {
          key: 'brand',
          type: 'multi-select',
          label: 'brand',
          unit: null,
          values: [{ value: 'bosch', label: 'Bosch', count: 5 }],
        },
      ],
      category: null,
      model: null,
      count,
      offset,
      limit: 12,
    });
    const empty = { ...listed(0), results: [] };
    const searchCopy = content('ru').partsSearch;
    const shop = vi.fn();

    afterEach(() => {
      vi.unstubAllGlobals();
      shop.mockReset();
    });

    const stubShop = (count: number) => {
      vi.stubEnv('MEDUSA_BACKEND_URL', 'http://shop.test');
      vi.stubEnv('MEDUSA_PUBLISHABLE_KEY', 'pk_test');
      setShop(false);
      shop.mockImplementation(async (url: string) => {
        const offset = Number(new URL(url).searchParams.get('offset') ?? 0);
        return Response.json(count ? listed(count, offset) : empty);
      });
      vi.stubGlobal('fetch', shop);
    };

    const showcase = async (count: number, path?: string) => {
      stubShop(count);
      return hub(undefined, [], path);
    };

    const shopSearches = () =>
      shop.mock.calls
        .map(([url]) => new URL(String(url)))
        .filter(({ pathname }) => pathname === '/store/search');

    it('opens the hub with the first page of the catalogue and a link to the next', async () => {
      const page = await showcase(30);
      const root = page.querySelector('parts-browse');

      expect(root?.id).toBe('catalogue');
      expect(root?.querySelector('h2')?.textContent?.trim()).toBe(
        searchCopy.allHeading,
      );
      expect(
        root?.querySelector('[data-parts-browse] li a')?.getAttribute('href'),
      ).toBe('/ru/parts/p/mann-filter-hu1/');
      expect(root?.querySelector('a[rel="next"]')?.getAttribute('href')).toBe(
        '/ru/parts/?offset=12#catalogue',
      );
      expect(root?.querySelector('a[rel="prev"]')).toBeNull();
      expect(root?.querySelector('[aria-live]')).not.toBeNull();
      expect(page.querySelector('meta[name="robots"]')).toBeNull();
      expect(
        shop.mock.calls.filter(([url]) =>
          String(url).includes('/store/catalogue-snapshot'),
        ),
      ).toEqual([]);
      expect(
        page.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      ).toBe('https://carlab.rs/ru/parts/');
    });

    it('filters and sorts the showcase on the hub itself', async () => {
      const root = (await showcase(30)).querySelector('parts-browse')!;
      const form = root.querySelector('form')!;

      expect(form.getAttribute('action')).toBe('/ru/parts/#catalogue');
      expect(form.querySelector('filter-sheet')).not.toBeNull();
      expect(
        form.querySelector('input[name="facets"][value="brand:bosch"]'),
      ).not.toBeNull();
      expect(
        root
          .querySelector(`a[href="/ru/parts/?sort=popular#catalogue"]`)
          ?.textContent?.trim(),
      ).toBe(searchCopy.sortPopular);
    });

    it('honours the chosen filters and page, kept out of the index', async () => {
      const page = await showcase(
        30,
        '/ru/parts/?facets=brand%3Abosch&offset=12',
      );
      const root = page.querySelector('parts-browse')!;
      const [listing] = shopSearches();

      expect(listing.searchParams.getAll('facets')).toEqual(['brand:bosch']);
      expect(listing.searchParams.get('offset')).toBe('12');
      expect(listing.searchParams.has('q')).toBe(false);
      expect(root.querySelector('a[rel="prev"]')?.getAttribute('href')).toBe(
        '/ru/parts/?facets=brand%3Abosch#catalogue',
      );
      expect(root.querySelector('a[rel="next"]')?.getAttribute('href')).toBe(
        '/ru/parts/?facets=brand%3Abosch&offset=24#catalogue',
      );
      expect(root.textContent).toContain('Bosch');
      expect(
        page.querySelector('meta[name="robots"]')?.getAttribute('content'),
      ).toContain('noindex');
      expect(
        page.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      ).toBe('https://carlab.rs/ru/parts/');
    });

    it('turns the inquiry button of the filters to the hub form', async () => {
      const root = (await showcase(30)).querySelector('parts-browse')!;

      expect(
        root
          .querySelector(`[${FILTERS_INQUIRY_ATTRIBUTE}]`)
          ?.getAttribute(FILTERS_INQUIRY_ATTRIBUTE),
      ).toBe('/ru/parts/#inquiry');
    });

    it('moves a page past the end back to the last one', async () => {
      stubShop(30);

      const response = await respond(
        PartsHub,
        new Request('https://carlab.rs/ru/parts/?offset=99'),
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(
        '/ru/parts/?offset=24#catalogue',
      );
    });

    it('sends a search query on to the search page', async () => {
      stubShop(30);

      const response = await respond(
        PartsHub,
        new Request('https://carlab.rs/ru/parts/?q=bosch&offset=12'),
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(
        '/ru/parts/search/?q=bosch&offset=12',
      );
      expect(shopSearches()).toEqual([]);
    });

    it('draws no pager when the catalogue fits on one page', async () => {
      const root = (await showcase(1)).querySelector('parts-browse');

      expect(root).not.toBeNull();
      expect(root?.querySelector('a[rel="next"], a[rel="prev"]')).toBeNull();
    });

    it('shows nothing for an empty catalogue or without a shop', async () => {
      expect((await showcase(0)).querySelector('parts-browse')).toBeNull();
      vi.unstubAllEnvs();
      expect((await hub()).querySelector('parts-browse')).toBeNull();
    });
  });
});
