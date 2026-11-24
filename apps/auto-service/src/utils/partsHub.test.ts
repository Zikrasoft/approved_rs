import { describe, expect, it } from 'vitest';
import type { CataloguePageList, Category } from '@podbor/catalog-contract';
import { PARTS_HUB_MODULE, partsHubOf, partsHubPlugin } from './partsHub';

const category = (slug: string): Category =>
  ({
    id: `category_${slug}`,
    slug,
    name: `${slug} ru`,
    text: `${slug} lead.\n\nMore.`,
    translations: { sr: { name: `${slug} sr`, text: `${slug} sr lead.` } },
  }) as unknown as Category;

const listOf = (
  makes: CataloguePageList['makes'] = [],
  categories: CataloguePageList['categories'] = [],
): CataloguePageList => ({
  parts: [],
  makes,
  series: [],
  categories,
  catalogue_makes: null,
});

const make = (slug: string, parts: number | null, hub = true) => ({
  slug,
  name: slug.toUpperCase(),
  hub,
  parts,
});

const counted = (slug: string, listed: number | null) => ({
  slug,
  name: slug,
  listed,
});

describe('the parts hub data', () => {
  it('keeps only what the hub draws, most demanded categories first, per locale', () => {
    const hub = partsHubOf(
      [category('wipers'), category('brakes')],
      listOf(
        [make('audi', 1), make('bmw', 9), make('lada', 99, false)],
        [counted('wipers', 0), counted('brakes', 5)],
      ),
    );

    expect(hub.makes).toEqual([
      { slug: 'bmw', name: 'BMW' },
      { slug: 'audi', name: 'AUDI' },
    ]);
    expect(hub.categories).toEqual([
      {
        slug: 'brakes',
        empty: false,
        name: { ru: 'brakes ru', sr: 'brakes sr', en: 'brakes ru' },
        lead: { ru: 'brakes lead.', sr: 'brakes sr lead.', en: 'brakes lead.' },
      },
      {
        slug: 'wipers',
        empty: true,
        name: { ru: 'wipers ru', sr: 'wipers sr', en: 'wipers ru' },
        lead: { ru: 'wipers lead.', sr: 'wipers sr lead.', en: 'wipers lead.' },
      },
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

  it('builds an empty hub into the bundle without a shop', async () => {
    const plugin = partsHubPlugin({});
    const id = plugin.resolveId(PARTS_HUB_MODULE)!;

    expect(plugin.resolveId('other')).toBeNull();
    expect(await plugin.load('other')).toBeNull();
    expect(await plugin.load(id)).toBe(
      'export default {"makes":[],"categories":[]};',
    );
  });
});
