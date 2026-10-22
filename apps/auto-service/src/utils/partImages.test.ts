import { describe, expect, it } from 'vitest';
import {
  imageAlt,
  pagesThumbnail,
  partGallery,
  partThumbnail,
} from './partImages';

const STATIC = 'https://api.carlab.rs/static';

const own = {
  src: `${STATIC}/a-960.webp`,
  width: 960,
  height: 720,
  srcset: [
    { url: `${STATIC}/a-160.webp`, width: 160 },
    { url: `${STATIC}/a-480.webp`, width: 480 },
    { url: `${STATIC}/a-960.webp`, width: 960 },
  ],
};

const page = (images: (typeof own)[], supplier: string[] = []) => ({
  part: { images },
  supplier_data: { cross_references: [], applicability: [], images: supplier },
});

const category = {
  image: {
    src: `${STATIC}/c-480.webp`,
    width: 480,
    height: 480,
    srcset: [
      { url: `${STATIC}/c-160.webp`, width: 160 },
      { url: `${STATIC}/c-480.webp`, width: 480 },
    ],
  },
};

describe('partGallery', () => {
  it('puts our own photos first, then the released supplier photos', () => {
    expect(
      partGallery(page([own], ['https://cdn.supplier.test/hu816x.jpg'])),
    ).toEqual([
      {
        src: own.src,
        srcset: `${STATIC}/a-160.webp 160w, ${STATIC}/a-480.webp 480w, ${STATIC}/a-960.webp 960w`,
        width: 960,
        height: 720,
        thumb: `${STATIC}/a-160.webp`,
      },
      {
        src: 'https://cdn.supplier.test/hu816x.jpg',
        srcset: undefined,
        width: 800,
        height: 800,
        thumb: 'https://cdn.supplier.test/hu816x.jpg',
      },
    ]);
  });

  it('is empty when nothing has a photo', () => {
    expect(partGallery(page([]))).toEqual([]);
  });
});

describe('partThumbnail', () => {
  it('takes the smallest copy of the first own photo', () => {
    expect(partThumbnail(page([own]), category)).toBe(`${STATIC}/a-160.webp`);
  });

  it('falls back to a supplier photo, then the Category photo, then nothing', () => {
    expect(partThumbnail(page([], ['https://cdn.test/x.jpg']), category)).toBe(
      'https://cdn.test/x.jpg',
    );
    expect(partThumbnail(page([]), category)).toBe(`${STATIC}/c-160.webp`);
    expect(partThumbnail(page([]), { image: null })).toBeNull();
    expect(partThumbnail(page([]), null)).toBeNull();
  });
});

describe('pagesThumbnail', () => {
  it('takes the first brand-number with a photo, then the Category photo', () => {
    expect(
      pagesThumbnail([
        { ...page([]), category },
        { ...page([], ['https://cdn.test/x.jpg']), category },
      ]),
    ).toBe('https://cdn.test/x.jpg');
    expect(pagesThumbnail([{ ...page([]), category }])).toBe(
      `${STATIC}/c-160.webp`,
    );
    expect(pagesThumbnail([])).toBeNull();
  });
});

describe('imageAlt', () => {
  it('names the brand, the number and the part', () => {
    expect(imageAlt('Mann-Filter', 'HU 816 x', 'Масляный фильтр')).toBe(
      'Mann-Filter HU 816 x, Масляный фильтр',
    );
  });
});
