import { describe, expect, it } from 'vitest';
import { currentNumber, splitNumbers } from './partNumbers';

describe('splitNumbers', () => {
  it('puts OEM numbers first and moves superseded ones aside', () => {
    const numbers = [
      { id: 'old', type: 'oem' as const, superseded: true },
      { id: 'mann', type: 'manufacturer-number' as const, superseded: false },
      { id: 'bmw', type: 'oem' as const, superseded: false },
      { id: 'mahle', type: 'manufacturer-number' as const, superseded: false },
    ];
    const { current, previous } = splitNumbers(numbers);
    expect(current.map(({ id }) => id)).toEqual(['bmw', 'mann', 'mahle']);
    expect(previous.map(({ id }) => id)).toEqual(['old']);
  });
});

describe('currentNumber', () => {
  const result = (slug: string, part: string, superseded = false) => ({
    brand: { slug },
    part: { id: part },
    superseded,
  });

  it('prefers a current number of the same brand and part', () => {
    const old = result('bmw', 'p1', true);
    const mahle = result('mahle', 'p1');
    const bmw = result('bmw', 'p1');
    const other = result('bmw', 'p2');
    expect(currentNumber(old, [old, mahle, other, bmw])).toBe(bmw);
    expect(currentNumber(old, [old, mahle])).toBe(mahle);
    expect(currentNumber(old, [old, other])).toBeUndefined();
  });
});
