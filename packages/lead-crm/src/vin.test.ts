import { describe, expect, it } from 'vitest';
import { VIN_PATTERN, vinOf, vinText, vinWhileTyping } from './vin.ts';

describe('VIN patterns', () => {
  it('accepts seventeen VIN characters and refuses I, O and Q', () => {
    expect(VIN_PATTERN.test('WBA8E9G50GNU12345')).toBe(true);
    expect(VIN_PATTERN.test('WBA8E9G50GNU1234O')).toBe(false);
    expect(VIN_PATTERN.test('wba8e9g50gnu12345')).toBe(false);
  });

  it.each([
    ['1234567890123456Z', 'a maker code of digits only'],
    ['YYYYYYYYYYYYYYYYY', 'no digit at all'],
  ])('refuses %s, which has %s', (text) => {
    expect(VIN_PATTERN.test(text)).toBe(false);
    expect(vinOf(text)).toBeNull();
  });

  it('accepts a maker code that mixes digits and a letter', () => {
    expect(VIN_PATTERN.test('1G1ZT51816F100001')).toBe(true);
    expect(VIN_PATTERN.test('9BWZZZ377VT004251')).toBe(true);
  });
});

describe('vinOf', () => {
  it('reads a VIN typed in any case with spaces around it', () => {
    expect(vinOf(' wba8e9g50gnu12345 ')).toBe('WBA8E9G50GNU12345');
  });

  it('reads a VIN pasted with spaces, dots or dashes inside', () => {
    expect(vinOf('WBA 35BG0-70N.074158')).toBe('WBA35BG070N074158');
  });

  it('refuses a VIN of the wrong length', () => {
    expect(vinOf('WBA8E9G50GNU1234')).toBeNull();
  });

  it('reads O and Q as 0 and I as 1, which no VIN holds', () => {
    expect(vinOf('WBA35BGO7ON074158')).toBe('WBA35BG070N074158');
    expect(vinOf('wba35bgq70n07415i')).toBe('WBA35BG070N074151');
    expect(vinOf('vin: WBA35BGO7ON074158')).toBe('WBA35BG070N074158');
  });

  it('reads Cyrillic look-alike letters typed on a Russian layout as Latin', () => {
    expect(vinOf('WВА35ВG070N074158')).toBe('WBA35BG070N074158');
    expect(vinOf('wва35вg070n074158')).toBe('WBA35BG070N074158');
  });

  it('finds the VIN behind a prefix or among other words', () => {
    expect(vinOf('VIN WBA35BG070N074158')).toBe('WBA35BG070N074158');
    expect(vinOf('vin: WBA 35BG 070N074158')).toBe('WBA35BG070N074158');
    expect(vinOf('WBA35BG070N074158, BMW')).toBe('WBA35BG070N074158');
    expect(vinOf('WBA35BG070N074158🚗')).toBe('WBA35BG070N074158');
  });

  it('keeps a Cyrillic У right after the VIN prefix as the Y it looks like', () => {
    expect(vinOf('vin: УВА8Е31000А000001')).toBe('YBA8E31000A000001');
  });

  it('refuses an all-У string, though it reads as Latin', () => {
    expect(vinOf('УУУУУУУУУУУУУУУУУ')).toBeNull();
  });

  it('refuses seventeen digits, which no VIN is', () => {
    expect(vinOf('12345678901234567')).toBeNull();
    expect(VIN_PATTERN.test('12345678901234567')).toBe(false);
  });

  it('refuses text that only holds a VIN-length run of other words', () => {
    expect(vinOf('HU 816 x, OX 404 D')).toBeNull();
  });

  it('reads a VIN typed on the Russian keyboard layout', () => {
    expect(vinOf('ЦИФ35ИП070Т074158')).toBe('WBA35BG070N074158');
    expect(vinOf('мшт циф35ип070т074158')).toBe('WBA35BG070N074158');
    expect(vinOf('мштциф35ип070т074158')).toBe('WBA35BG070N074158');
  });

  it('refuses Russian text that maps to no VIN on either layout', () => {
    expect(vinOf('хлеб и масло, 17 штук')).toBeNull();
    expect(vinOf('масляный фильтр bmw')).toBeNull();
  });

  it('reads a VIN glued to its VIN label', () => {
    expect(vinOf('VINWBA35BG070N074158')).toBe('WBA35BG070N074158');
    expect(vinOf('vinwва35вg070n074158')).toBe('WBA35BG070N074158');
  });
});

describe('vinText', () => {
  it('spells typed text the way a VIN is read, whether or not it is one', () => {
    expect(vinText('vin: wва 35вg-07.0n0741')).toBe('WBA35BG070N0741');
  });

  it('spells a VIN typed on the Russian layout as the VIN it is', () => {
    expect(vinText('циф35ип070т074158')).toBe('WBA35BG070N074158');
  });
});

describe('vinWhileTyping', () => {
  it('drops separators and capitalises, but leaves the prefix and Cyrillic to the blur', () => {
    expect(vinWhileTyping('vin wва-35')).toBe('VINWВА35');
  });
});
