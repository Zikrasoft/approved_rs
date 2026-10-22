import { describe, expect, it } from 'vitest';
import type { PartPageEntry } from './catalogue';
import { partSuccessor } from './partSuccessor';

const bmw = { name: 'BMW', slug: 'bmw' };
const mann = { name: 'Mann-Filter', slug: 'mann-filter' };

const number = (
  brand: typeof bmw,
  normalized_value: string,
  superseded = false,
) => ({
  id: `pi_${normalized_value}`,
  type: 'oem' as const,
  value: normalized_value,
  normalized_value,
  superseded,
  brand,
});

const entry = (
  numbered: ReturnType<typeof number>,
  overrides: Partial<PartPageEntry> = {},
): PartPageEntry => ({
  ...numbered,
  slug: `${numbered.brand.slug}-${numbered.normalized_value.toLowerCase()}`,
  part: {
    id: 'part_1',
    name: 'Oil filter',
    translations: null,
    replaced_by: null,
    category_id: null,
    attributes: {},
  },
  images: [],
  equivalents: [],
  offers: [],
  supplier_data: { cross_references: [], applicability: [], images: [] },
  indexable: false,
  priceOnRequest: true,
  category: null,
  fits: [],
  requirementCars: [],
  kitCars: [],
  ...overrides,
});

const index = (...pages: PartPageEntry[]) =>
  new Map(pages.map((page) => [page.slug, page]));

describe('partSuccessor', () => {
  const current = entry(number(bmw, '11428575211'));
  const mannCurrent = entry(number(mann, 'HU816X'));

  it('sends a superseded number to the current number of the same brand first', () => {
    const dead = entry(number(bmw, '11428507683', true), {
      superseded: true,
      equivalents: [
        number(mann, 'HU816X'),
        number(bmw, '11428575211'),
        number(bmw, '11420000000', true),
      ],
    });

    expect(partSuccessor(dead, index(current, mannCurrent))).toBe(current);
  });

  it('sends a replaced part to its replacement', () => {
    const old = entry(number(bmw, '34116860242'), {
      part: {
        ...current.part,
        replaced_by: {
          id: 'part_2',
          name: 'Brake pads',
          translations: null,
          brand_number: number(mann, 'HU816X'),
        },
      },
    });

    expect(partSuccessor(old, index(mannCurrent))).toBe(mannCurrent);
  });

  it('sends a replaced part to the number of its replacement that is in stock', () => {
    const ate = { name: 'ATE', slug: 'ate' };
    const offer = (price: number, stock_quantity: number) => ({
      id: `of_${price}`,
      price,
      currency: 'RSD',
      stock_quantity,
      lead_time_days: 0,
    });
    const successorPart = { ...current.part, id: 'part_2' };
    const named = entry(number(bmw, '34116860242'), { part: successorPart });
    const outOfStock = entry(number(mann, 'X1'), {
      part: successorPart,
      offers: [offer(100, 0)],
    });
    const inStock = entry(number(ate, '13046027862'), {
      part: successorPart,
      offers: [offer(6600, 3)],
    });
    const old = entry(number(ate, '13046072172'), {
      part: {
        ...current.part,
        replaced_by: {
          id: 'part_2',
          name: 'Brake pads',
          translations: null,
          brand_number: number(bmw, '34116860242'),
        },
      },
    });

    expect(partSuccessor(old, index(named, outOfStock, inStock, old))).toBe(
      inStock,
    );
  });

  it('has none for a current number', () => {
    expect(partSuccessor(current, index(current))).toBeNull();
  });
});
