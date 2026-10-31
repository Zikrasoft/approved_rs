import { describe, expect, it } from 'vitest';
import { fromRussianLayout, toRussianLayout } from './keyboardLayout.ts';

describe('keyboard layouts', () => {
  it('retypes keys pressed on the Russian layout as the Latin ones under them', () => {
    expect(fromRussianLayout('Щшд ашдеук, ЖЭБ')).toBe("oil filter, ;',");
  });

  it('retypes keys pressed on the Latin layout as the Russian ones under them', () => {
    expect(toRussianLayout('vfckzysq [`')).toBe('масляный хё');
  });

  it('keeps keys it has no counterpart for', () => {
    expect(fromRussianLayout('ЦИФ35ИП070Т074158')).toBe('wba35bg070n074158');
  });
});
