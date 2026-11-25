import { describe, expect, it } from 'vitest';
import {
  CATEGORY_PAGE_SIZE,
  categoryFacets,
  categoryPageCount,
  categoryPagePath,
  categoryPageResponseSchema,
  popularPicks,
} from './categoryPageView.ts';

const category = {
  id: 'cat_1',
  slug: 'batteries',
  name: 'Batteries',
  text: '',
  translations: null,
  maintenance_kit: false,
  kit_rank: 0,
  service_label: null,
  service_price: null,
  service_note: null,
  image: null,
  fields: [],
};

const entry = {
  id: 'pi_1',
  type: 'manufacturer-number',
  value: 'A 1',
  normalized_value: 'A1',
  superseded: false,
  listed: true,
  brand: { name: 'Varta', slug: 'varta' },
  images: [],
  part: {
    id: 'part_1',
    name: 'Battery',
    description: null,
    translations: null,
    replaced_by: null,
    category_id: 'cat_1',
    attributes: {},
    installation_price: null,
  },
  equivalents: [],
  offers: [],
  supplier_data: { cross_references: [], applicability: [], images: [] },
  demand: null,
  slug: 'varta-a1',
};

const response = {
  category,
  page: 1,
  pages: 1,
  count: 1,
  entries: [entry],
};

describe('categoryPageResponseSchema', () => {
  it('reads an answer and strips a key a newer shop adds', () => {
    const parsed = categoryPageResponseSchema.parse({
      ...response,
      generated_at: 'now',
    });
    expect(parsed.entries[0].slug).toBe('varta-a1');
    expect('generated_at' in parsed).toBe(false);
  });

  it('reads an older shop without the derived blocks as none', () => {
    expect(categoryPageResponseSchema.parse(response)).toMatchObject({
      popular: [],
      facets: [],
      ranges: [],
      uniform: [],
      demanded: false,
      cars: [],
    });
  });

  it('drops a facet of a field type newer than the contract', () => {
    const facet = (type: string) => ({
      key: 'k',
      type,
      label: 'K',
      unit: null,
      values: [],
    });
    const parsed = categoryPageResponseSchema.parse({
      ...response,
      facets: [facet('single-select'), facet('hologram')],
    });
    expect(parsed.facets).toHaveLength(1);
  });

  it('refuses an answer without its Category', () => {
    const { category: _category, ...broken } = response;
    expect(categoryPageResponseSchema.safeParse(broken).success).toBe(false);
  });
});

describe('the category page request', () => {
  it('names the path by slug and page', () => {
    expect(categoryPagePath('brake-pads')).toBe(
      '/store/catalogue-pages/categories/brake-pads?page=1',
    );
    expect(categoryPagePath('brake-pads', 3)).toBe(
      '/store/catalogue-pages/categories/brake-pads?page=3',
    );
    expect(CATEGORY_PAGE_SIZE).toBe(48);
  });
});

describe('popularPicks', () => {
  const popular = (id: string, score: number, part = id) => ({
    part: { id: part },
    demand: { score, popular: true, top: false },
  });

  it('ranks by score and keeps one number per part', () => {
    expect(
      popularPicks([
        popular('a', 1),
        popular('b', 9),
        popular('c', 5, 'b'),
      ]).map(({ part }) => part.id),
    ).toEqual(['b', 'a']);
  });

  it('shows no block for a single pick', () => {
    expect(popularPicks([popular('a', 1), { demand: null }])).toEqual([]);
  });

  it('caps the block', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      popular(`p${index}`, index),
    );
    expect(popularPicks(many)).toHaveLength(6);
  });
});

describe('categoryFacets', () => {
  const offer = (price: number, stock: number) => ({
    id: `o${price}`,
    price,
    currency: 'RSD',
    stock_quantity: stock,
    lead_time_days: 0,
  });
  const item = (brand: string, offers = [offer(100, 1)]) => ({
    brand: { slug: brand, name: brand.toUpperCase() },
    offers,
    attributes: {},
  });

  it('offers the brands, stock and price of the whole Category', () => {
    const facets = categoryFacets(
      [],
      [item('varta'), item('bosch', [offer(300, 0)]), item('varta', [])],
      'ru',
    );
    expect(facets.map(({ values }) => values.length)).toEqual([2, 1, 2]);
    expect(facets[0].values.map(({ label }) => label)).toEqual([
      'BOSCH',
      'VARTA',
    ]);
  });

  it('offers nothing to filter by in an empty Category', () => {
    expect(categoryFacets([], [], 'ru')).toEqual([]);
  });

  it('describes the faceted fields of the Category', () => {
    const field = {
      key: 'capacity',
      type: 'single-select' as const,
      unit: null,
      label: 'Capacity',
      translations: null,
      required: false,
      facet: true,
      rank: 0,
      options: [
        { key: 'big', label: 'Big', translations: null, rank: 0 },
        { key: 'small', label: 'Small', translations: null, rank: 1 },
      ],
    };
    const facets = categoryFacets(
      [field],
      [
        { ...item('varta'), attributes: { capacity: 'big' } },
        { ...item('varta'), attributes: { capacity: 'small' } },
        item('varta'),
      ],
      'ru',
    );
    expect(facets.find(({ key }) => key === 'capacity')?.values).toHaveLength(
      2,
    );
  });
});

describe('categoryPageCount', () => {
  it('keeps one page for an empty Category and adds one per full page', () => {
    expect(categoryPageCount(0)).toBe(1);
    expect(categoryPageCount(48)).toBe(1);
    expect(categoryPageCount(49)).toBe(2);
    expect(categoryPageCount(97)).toBe(3);
  });
});
