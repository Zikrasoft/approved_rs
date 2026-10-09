import { BigNumber } from '@medusajs/framework/utils';
import { z } from 'zod';

import { fieldsOf } from '../query';
import { moneyField, quantityField } from '../row-schema';

describe('moneyField', () => {
  it.each([
    [12690, 12690],
    ['12690', 12690],
    [' 3390.5 ', 3390.5],
    [0, 0],
    [new BigNumber(12690), 12690],
    [new BigNumber({ value: '3390.5', precision: 20 }), 3390.5],
  ])('reads %p as %p', (value, expected) => {
    expect(moneyField.parse(value)).toBe(expected);
  });

  it.each([
    null,
    'abc',
    { value: '12690', precision: 20 },
    undefined,
    '',
    '  ',
    true,
    NaN,
    Infinity,
  ])('refuses %p rather than calling it zero', (value) => {
    expect(moneyField.safeParse(value).success).toBe(false);
  });

  it('is a leaf fieldsOf can walk', () => {
    expect(fieldsOf(z.object({ total: moneyField }))).toEqual(['total']);
  });
});

describe('quantityField', () => {
  it.each([
    [new BigNumber(2), 2],
    ['3', 3],
    [0, 0],
  ])('reads %p as %p', (value, expected) => {
    expect(quantityField.parse(value)).toBe(expected);
  });

  it.each([1.5, -1, 'x'])('refuses %p', (value) => {
    expect(quantityField.safeParse(value).success).toBe(false);
  });
});
