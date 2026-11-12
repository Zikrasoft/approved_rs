import { isNewBrand } from '../brand-options';

const brands = [
  { name: 'Bosch', spellings: [{ value: 'Бош' }] },
  { name: 'Mann-Filter', spellings: [] },
];

describe('isNewBrand', () => {
  it.each([
    ['Bosch', false],
    ['  bosch ', false],
    ['бош', false],
    ['MANN-FILTER', false],
    ['Febi', true],
  ])('%s -> %s', (typed, expected) => {
    expect(isNewBrand(typed, brands)).toBe(expected);
  });

  it('is not new while empty', () => {
    expect(isNewBrand('   ', brands)).toBe(false);
  });
});
