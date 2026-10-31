import { describe, expect, it } from 'vitest';
import {
  localizedUnit,
  translated,
  translationsSchema,
} from './translations.ts';

describe('translationsSchema', () => {
  it('strips a locale the contract does not know yet', () => {
    expect(
      translationsSchema.parse({
        sr: { name: 'Filter ulja' },
        en: { name: 'Oil filter' },
        de: { name: 'Ölfilter' },
      }),
    ).toEqual({ sr: { name: 'Filter ulja' }, en: { name: 'Oil filter' } });
  });

  it('accepts no translations at all', () => {
    expect(translationsSchema.parse(null)).toBeNull();
    expect(translationsSchema.parse({})).toEqual({});
  });
});

describe('translated', () => {
  it('falls back to the Russian column without a translation', () => {
    const row = {
      name: 'Масляный фильтр',
      translations: { sr: { name: 'Filter ulja' } },
    };
    expect(translated(row, 'name', 'sr')).toBe('Filter ulja');
    expect(translated(row, 'name', 'en')).toBe('Масляный фильтр');
  });
});

describe('localizedUnit', () => {
  it('writes a Russian unit symbol in Latin for every other locale', () => {
    expect(localizedUnit('А·ч', 'en')).toBe('Ah');
    expect(localizedUnit('В', 'sr')).toBe('V');
    expect(localizedUnit('мм', 'sr')).toBe('mm');
  });

  it('keeps the unit on a Russian page, and a unit it does not know', () => {
    expect(localizedUnit('А·ч', 'ru')).toBe('А·ч');
    expect(localizedUnit('Nm', 'en')).toBe('Nm');
    expect(localizedUnit(null, 'en')).toBeNull();
  });
});
