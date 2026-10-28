import { describe, expect, it } from 'vitest';
import { translated, translationsSchema } from './translations.ts';

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
