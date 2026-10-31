import { offerLineTitle } from '../line-metadata';

describe('offerLineTitle', () => {
  it('moves a trailing brand and number into the brackets', () => {
    expect(
      offerLineTitle({
        slug: 'mann-filter-w71266',
        brand: 'MANN-FILTER',
        number: 'W 712/66',
        name: 'Масляный фильтр MANN-FILTER W 712/66',
      }),
    ).toBe('Масляный фильтр (MANN-FILTER W 712/66)');
  });

  it('adds the brand and number to a bare name', () => {
    expect(
      offerLineTitle({
        slug: 'varta-580901080',
        brand: 'VARTA',
        number: '580 901 080',
        name: 'Аккумулятор',
      }),
    ).toBe('Аккумулятор (VARTA 580 901 080)');
  });
});
