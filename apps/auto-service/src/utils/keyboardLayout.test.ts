import { describe, expect, it } from 'vitest';
import { otherLayout } from './keyboardLayout';

describe('otherLayout', () => {
  it.each([
    ['щшд ашдеук', 'oil filter'],
    ['vfckzysq abkmnh', 'масляный фильтр'],
    ['Njhvjpyst rjkjlrb', 'тормозные колодки'],
    ['nfqvth', 'таймер'],
    ['РГ816ч', 'hu816x'],
    ['13ю0460-2786ю2', '13.0460-2786.2'],
  ])('retypes %s as %s', (typed, meant) => {
    expect(otherLayout(typed)).toBe(meant);
  });

  it.each(['HU 816 x', 'масляный 5w', '816', '  ', ''])(
    'leaves %j alone: a Latin number or mixed scripts are not a layout slip',
    (typed) => {
      expect(otherLayout(typed)).toBeNull();
    },
  );
});
