import { describe, expect, it } from 'vitest';
import { VIN_PATTERN, vinOf, vinText } from './vin.ts';

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

  it('refuses a VIN with I, O or Q or of the wrong length', () => {
    expect(vinOf('WBA8E9G50GNU1234O')).toBeNull();
    expect(vinOf('WBA8E9G50GNU1234')).toBeNull();
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
});

describe('vinText', () => {
  it('spells typed text the way a VIN is read, whether or not it is one', () => {
    expect(vinText('vin: wва 35вg-07.0n0741')).toBe('WBA35BG070N0741');
  });
});
