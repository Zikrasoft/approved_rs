import { describe, expect, it } from 'vitest';
import { partPage } from '@/components/renderAstro';
import type { CategoryPageEntry } from './catalogueSnapshot';
import { PARTS_HUB_MODULE, partsHubOf, partsHubPlugin } from './partsHub';

const category = (slug: string, score = 0, empty = false): CategoryPageEntry =>
  ({
    id: `category_${slug}`,
    slug,
    name: `${slug} ru`,
    text: `${slug} lead.\n\nMore.`,
    translations: { sr: { name: `${slug} sr`, text: `${slug} sr lead.` } },
    pages: empty
      ? []
      : [
          partPage({
            demand: score ? { score, popular: false, top: false } : null,
          }),
        ],
  }) as unknown as CategoryPageEntry;

const make = (slug: string, parts: number) => ({
  make: { slug, name: slug.toUpperCase() },
  series: [],
  parts,
});

describe('the parts hub data', () => {
  it('keeps only what the hub draws, most demanded categories first, per locale', () => {
    const hub = partsHubOf(
      [category('wipers', 0, true), category('brakes', 5)],
      [make('audi', 1), make('bmw', 9)],
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

    expect(partsHubOf([], many).makes).toHaveLength(12);
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
