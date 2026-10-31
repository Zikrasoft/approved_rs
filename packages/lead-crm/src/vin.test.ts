import { describe, expect, it } from 'vitest';
import { VIN_INPUT_PATTERN, VIN_PATTERN, vinOf, vinText } from './vin.ts';

describe('VIN patterns', () => {
  it('accepts seventeen VIN characters and refuses I, O and Q', () => {
    expect(VIN_PATTERN.test('WBA8E9G50GNU12345')).toBe(true);
    expect(VIN_PATTERN.test('WBA8E9G50GNU1234O')).toBe(false);
    expect(VIN_PATTERN.test('wba8e9g50gnu12345')).toBe(false);
  });

  it('lets the HTML field take the same VIN in either case', () => {
    const field = new RegExp(`^(?:${VIN_INPUT_PATTERN})$`, 'v');
    expect(field.test('wba8e9g50gnu12345')).toBe(true);
    expect(field.test('WBA8E9G50GNU12345')).toBe(true);
    expect(field.test('wba8e9g50gnu1234q')).toBe(false);
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

  it('refuses text that only holds a VIN-length run of other words', () => {
    expect(vinOf('HU 816 x, OX 404 D')).toBeNull();
  });
});

describe('vinText', () => {
  it('spells typed text the way a VIN is read, whether or not it is one', () => {
    expect(vinText('vin: wва 35вg-07.0n0741')).toBe('WBA35BG070N0741');
  });
});
