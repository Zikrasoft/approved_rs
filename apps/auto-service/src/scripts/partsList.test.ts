import { describe, expect, it } from 'vitest';
import {
  addToPartsList,
  clearPartsList,
  inquiryComment,
  PARTS_LIST_STORAGE_KEY,
  readPartsList,
  removeFromPartsList,
} from './partsList';

const memoryStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

const blockedStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const mannOil = {
  slug: 'mann-filter-hu816x',
  brand: 'Mann-Filter',
  number: 'HU 816 x',
  name: 'Масляный фильтр',
};
const bmwOil = {
  slug: 'bmw-11428575211',
  brand: 'BMW',
  number: '11 42 8575211',
  name: 'Масляный фильтр',
};

describe('parts list', () => {
  it('keeps added parts for the next page load', () => {
    const storage = memoryStorage();

    addToPartsList(mannOil, storage);
    addToPartsList(bmwOil, storage);

    expect(
      readPartsList(
        memoryStorage({
          [PARTS_LIST_STORAGE_KEY]: storage.getItem(PARTS_LIST_STORAGE_KEY)!,
        }),
      ),
    ).toEqual([mannOil, bmwOil]);
  });

  it('lists a brand-number once however often it is added', () => {
    const storage = memoryStorage();

    addToPartsList(mannOil, storage);
    addToPartsList(mannOil, storage);

    expect(readPartsList(storage)).toEqual([mannOil]);
  });

  it('removes one part and clears the rest', () => {
    const storage = memoryStorage();
    addToPartsList(mannOil, storage);
    addToPartsList(bmwOil, storage);

    removeFromPartsList(mannOil.slug, storage);
    expect(readPartsList(storage)).toEqual([bmwOil]);

    clearPartsList(storage);
    expect(readPartsList(storage)).toEqual([]);
  });

  it.each(['not json', '{"slug":1}', '[{"slug":"x"}]'])(
    'reads a damaged list %j as empty',
    (stored) => {
      expect(
        readPartsList(memoryStorage({ [PARTS_LIST_STORAGE_KEY]: stored })),
      ).toEqual([]);
    },
  );

  it('works as an empty list when storage is blocked', () => {
    expect(() => addToPartsList(mannOil, blockedStorage)).not.toThrow();
    expect(() => clearPartsList(blockedStorage)).not.toThrow();
    expect(readPartsList(blockedStorage)).toEqual([]);
  });
});

describe('inquiryComment', () => {
  const more = (count: number) => `+${count} не поместились`;

  it('carries the car and one line per part before the visitor note', () => {
    expect(
      inquiryComment({
        car: 'BMW 320d F30',
        parts: [mannOil, bmwOil],
        note: 'Нужно к пятнице',
        limit: 2000,
        more,
      }),
    ).toBe(
      [
        'BMW 320d F30',
        'Mann-Filter HU 816 x, Масляный фильтр',
        'BMW 11 42 8575211, Масляный фильтр',
        'Нужно к пятнице',
      ].join('\n'),
    );
  });

  it('leaves out the car and the note when there are none', () => {
    expect(
      inquiryComment({
        car: '',
        parts: [mannOil],
        note: '  ',
        limit: 2000,
        more,
      }),
    ).toBe('Mann-Filter HU 816 x, Масляный фильтр');
  });

  it('cuts the list at the limit and counts the parts left out', () => {
    const parts = Array.from({ length: 5 }, (_, index) => ({
      slug: `bmw-${index}`,
      brand: 'BMW',
      number: `1000${index}`,
      name: 'Фильтр',
    }));

    const comment = inquiryComment({
      car: 'BMW X5',
      parts,
      note: '',
      limit: 60,
      more,
    });

    expect(comment).toBe(
      [
        'BMW X5',
        'BMW 10000, Фильтр',
        'BMW 10001, Фильтр',
        '+3 не поместились',
      ].join('\n'),
    );
    expect(comment.length).toBeLessThanOrEqual(60);
  });

  it('never exceeds the limit even when the note alone is too long', () => {
    const comment = inquiryComment({
      car: '',
      parts: [mannOil],
      note: 'x'.repeat(100),
      limit: 50,
      more,
    });

    expect(comment.length).toBe(50);
    expect(comment.startsWith('+1 не поместились')).toBe(true);
  });
});
