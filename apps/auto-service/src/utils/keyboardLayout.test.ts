import { describe, expect, it } from 'vitest';
import { fromRussianLayout, otherLayout } from './keyboardLayout';

describe('otherLayout', () => {
  it.each([
    ['щшд ашдеук', 'oil filter'],
    ['vfckzysq abkmnh', 'масляный фильтр'],
    ['Njhvjpyst rjkjlrb', 'тормозные колодки'],
    ['nfqvth', 'таймер'],
  ])('retypes %s as %s', (typed, meant) => {
    expect(otherLayout(typed)).toBe(meant);
  });

  it.each(['HU 816 x', 'масляный 5w', '  ', ''])(
    'leaves %j alone: digits or mixed scripts are not a layout slip',
    (typed) => {
      expect(otherLayout(typed)).toBeNull();
    },
  );
});

describe('fromRussianLayout', () => {
  it('keeps keys it has no counterpart for', () => {
    expect(fromRussianLayout('ЦИФ35ИП070Т074158')).toBe('wba35bg070n074158');
  });
});
