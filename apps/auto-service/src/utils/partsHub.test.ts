import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CataloguePartsHub, Category } from '@podbor/catalog-contract';
import type { Catalogue } from './cataloguePage';
import { EMPTY_PARTS_HUB, loadPartsHub, partsHubOf } from './partsHub';

const category = (slug: string): Category =>
  ({
    id: `category_${slug}`,
    slug,
    name: `${slug} ru`,
    text: `${slug} lead.\n\nMore.`,
    translations: { sr: { name: `${slug} sr`, text: `${slug} sr lead.` } },
  }) as unknown as Category;

const listOf = (
  makes: CataloguePartsHub['makes'] = [],
  categories: CataloguePartsHub['categories'] = [],
): CataloguePartsHub => ({ makes, categories });

const make = (slug: string, parts: number | null, hub = true) => ({
  slug,
  name: slug.toUpperCase(),
  hub,
  parts,
});

const counted = (
  slug: string,
  listed: number | null,
  demand: number | null = null,
) => ({
  slug,
  name: slug,
  listed,
  demand,
});

describe('the parts hub data', () => {
  it('keeps only what the hub draws, most demanded categories first, per locale', () => {
    const hub = partsHubOf(
      [category('wipers'), category('brakes')],
      listOf(
        [make('audi', 1), make('bmw', 9), make('lada', 99, false)],
        [counted('brakes', 50, 0), counted('wipers', 2, 7)],
      ),
    );

    expect(hub.makes).toEqual([
      { slug: 'bmw', name: 'BMW' },
      { slug: 'audi', name: 'AUDI' },
    ]);
    expect(hub.categories).toEqual([
      {
        slug: 'wipers',
        empty: false,
        name: { ru: 'wipers ru', sr: 'wipers sr', en: 'wipers ru' },
        lead: { ru: 'wipers lead.', sr: 'wipers sr lead.', en: 'wipers lead.' },
      },
      {
        slug: 'brakes',
        empty: false,
        name: { ru: 'brakes ru', sr: 'brakes sr', en: 'brakes ru' },
        lead: { ru: 'brakes lead.', sr: 'brakes sr lead.', en: 'brakes lead.' },
      },
    ]);
  });

  it('marks a Category with nothing listed as empty and keeps the list order without demand', () => {
    const hub = partsHubOf(
      [category('wipers'), category('brakes')],
      listOf([], [counted('wipers', 0), counted('brakes', 5)]),
    );

    expect(hub.categories.map(({ slug, empty }) => [slug, empty])).toEqual([
      ['wipers', true],
      ['brakes', false],
    ]);
  });

  it('caps the makes at the top ones', () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      make(`m${index}`, index),
    );

    expect(partsHubOf([], listOf(many)).makes).toHaveLength(12);
  });

  it('ranks a Make a shop sent no count for last and a Category with no count as not empty', () => {
    const hub = partsHubOf(
      [category('wipers')],
      listOf([make('old', null), make('new', 2)], [counted('wipers', null)]),
    );

    expect(hub.makes.map(({ slug }) => slug)).toEqual(['new', 'old']);
    expect(hub.categories[0].empty).toBe(false);
  });
});

describe('loadPartsHub', () => {
  afterEach(() => vi.restoreAllMocks());

  const page = () => ({
    request: new Request('https://carlab.rs/sr/parts/'),
    response: { headers: new Headers() } as ResponseInit & {
      headers: Headers;
    },
  });

  const catalogueOf = (partsHub: () => Promise<CataloguePartsHub>) =>
    ({
      categories: async () => [category('brakes')],
      partsHub,
    }) as unknown as Catalogue;

  const loaded = catalogueOf(async () =>
    listOf([make('bmw', 9)], [counted('brakes', 5, 1)]),
  );

  it('loads the hub and caches the page publicly when the browse found something', async () => {
    const astro = page();

    const hub = await loadPartsHub(astro, loaded, true);

    expect(hub.makes).toEqual([{ slug: 'bmw', name: 'BMW' }]);
    expect(hub.categories.map(({ slug }) => slug)).toEqual(['brakes']);
    expect(astro.response.headers.get('cache-control')).toBe(
      'public, s-maxage=86400',
    );
  });

  it('waits for a browse still running before it caches', async () => {
    const astro = page();

    await loadPartsHub(astro, loaded, Promise.resolve(true));

    expect(astro.response.headers.get('cache-control')).toBe(
      'public, s-maxage=86400',
    );
  });

  it('leaves the cache header alone when the browse found nothing', async () => {
    const astro = page();

    await loadPartsHub(astro, loaded, false);

    expect(astro.response.headers.get('cache-control')).toBeNull();
  });

  it('falls back to the empty hub, uncached, when the shop fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const astro = page();

    const hub = await loadPartsHub(
      astro,
      catalogueOf(async () => {
        throw new Error('shop down');
      }),
      true,
    );

    expect(hub).toBe(EMPTY_PARTS_HUB);
    expect(astro.response.headers.get('cache-control')).toBeNull();
    expect(logged).toHaveBeenCalledWith('parts hub failed', 'Error: shop down');
  });

  it('answers the empty hub, uncached, without a catalogue', async () => {
    const astro = page();

    expect(await loadPartsHub(astro, null, true)).toBe(EMPTY_PARTS_HUB);
    expect(astro.response.headers.get('cache-control')).toBeNull();
  });
});
