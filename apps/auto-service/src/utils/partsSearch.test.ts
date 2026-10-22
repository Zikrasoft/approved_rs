import { describe, expect, it } from 'vitest';
import { chosenFilters, facetValueLabel } from './partsSearch';

const copy = { booleanTrue: 'да', booleanFalse: 'нет' };
const capacity = {
  key: 'capacity',
  label: 'Емкость',
  unit: 'Ah',
  values: [{ value: '80', label: '80', count: 2 }],
};
const viscosity = {
  key: 'viscosity',
  label: 'Вязкость',
  unit: null,
  values: [{ value: '5w-30', label: '5W-30', count: 1 }],
};

describe('facetValueLabel', () => {
  it('prefers the option label, then yes or no, then the value with its unit', () => {
    expect(facetValueLabel(viscosity, viscosity.values[0], copy)).toBe('5W-30');
    expect(
      facetValueLabel(viscosity, { value: 'true', label: 'true' }, copy),
    ).toBe('да');
    expect(
      facetValueLabel(viscosity, { value: 'false', label: 'false' }, copy),
    ).toBe('нет');
    expect(facetValueLabel(capacity, capacity.values[0], copy)).toBe('80 Ah');
    expect(facetValueLabel(viscosity, { value: '4', label: '4' }, copy)).toBe(
      '4',
    );
  });
});

describe('chosenFilters', () => {
  it('names each chosen filter by its field and value', () => {
    expect(
      chosenFilters(
        [viscosity, capacity],
        ['capacity:80', 'viscosity:0w-20'],
        copy,
      ),
    ).toEqual([
      { filter: 'capacity:80', label: 'Емкость: 80 Ah' },
      { filter: 'viscosity:0w-20', label: '0w-20' },
    ]);
  });
});
