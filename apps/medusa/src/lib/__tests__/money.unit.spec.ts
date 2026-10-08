import { BigNumber } from '@medusajs/framework/utils';

import { money } from '../money';

describe('money', () => {
  it.each([
    [12690, 12690],
    ['12690', 12690],
    [0, 0],
  ])('reads %p as %p', (value, expected) => {
    expect(money(value)).toBe(expected);
  });

  it.each([
    [new BigNumber(12690), 12690],
    [new BigNumber({ value: '3390.5', precision: 20 }), 3390.5],
  ])(
    'reads a Medusa BigNumber — query.graph returns them for item.total',
    (value, expected) => {
      expect(money(value)).toBe(expected);
    },
  );

  it.each([
    [null, 'object'],
    ['abc', 'string'],
    [{ value: '12690', precision: 20 }, 'object'],
    [undefined, 'undefined'],
    ['', 'string'],
    ['  ', 'string'],
    [true, 'boolean'],
    [NaN, 'number'],
    [Infinity, 'number'],
  ])('refuses %p rather than calling it zero', (value, type) => {
    expect(() => money(value)).toThrow(`unreadable amount of type ${type}`);
  });
});
