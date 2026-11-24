import { describe, expect, it } from 'vitest';
import {
  MAKE_SHOWCASE,
  bestPage,
  offerRank,
  pictureRank,
  showcaseOf,
  type Showcased,
} from './showcase.ts';

type Page = Showcased & { value: string };

const page = (
  value: string,
  {
    stock,
    photo = false,
    illustrated = false,
  }: { stock?: number; photo?: boolean; illustrated?: boolean } = {},
): Page => ({
  value,
  offers:
    stock === undefined
      ? []
      : [
          {
            id: `offer_${value}`,
            price: 1500,
            currency: 'RSD',
            stock_quantity: stock,
            lead_time_days: stock > 0 ? 0 : 7,
          },
        ],
  images: [],
  supplier_data: { images: photo ? ['https://img.example/a.jpg'] : [] },
  category: illustrated ? { image: {} } : null,
});

const values = (pages: Page[]) => pages.map(({ value }) => value);

describe('the Make showcase', () => {
  it('ranks a Part by its best offer: in stock, on order, no price', () => {
    expect(offerRank([page('a', { stock: 2 })])).toBe(0);
    expect(offerRank([page('a', { stock: 0 })])).toBe(1);
    expect(offerRank([page('a')])).toBe(2);
  });

  it('ranks a picture: photo, illustration, none', () => {
    expect(pictureRank(page('a', { photo: true }))).toBe(0);
    expect(pictureRank(page('a', { illustrated: true }))).toBe(1);
    expect(pictureRank(page('a'))).toBe(2);
  });

  it('shows the brand holding the best offer', () => {
    const cheap = page('cheap', { stock: 1 });
    const other = page('other');

    expect(bestPage([other, cheap])).toBe(cheap);
    expect(bestPage([other])).toBeUndefined();
  });

  it('picks in-stock Parts first, then priced, then the rest', () => {
    const queue = [
      [page('none')],
      [page('order', { stock: 0 })],
      [page('stock', { stock: 2 })],
    ];

    expect(values(showcaseOf([queue]))).toEqual(['stock', 'order', 'none']);
  });

  it('leads with the column whose Part has a photo, pictured first inside it', () => {
    const plain = [[page('p1')], [page('p2')]];
    const shot = [[page('s1')], [page('s2', { photo: true })]];

    expect(values(showcaseOf([plain, shot]))).toEqual(['s2', 's1', 'p1', 'p2']);
  });

  it(`shows at most ${MAKE_SHOWCASE} Parts`, () => {
    const many = Array.from({ length: 9 }, (_, i) => [page(`m${i}`)]);

    expect(showcaseOf([many])).toHaveLength(MAKE_SHOWCASE);
  });

  it('is empty without Parts', () => {
    expect(showcaseOf([])).toEqual([]);
  });
});
