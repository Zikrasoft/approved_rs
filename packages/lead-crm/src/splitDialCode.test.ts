import { describe, it, expect } from 'vitest';
import { splitDialCode } from './splitDialCode.ts';

const COUNTRIES = [
  { iso: 'KZ', dial: '7', primary: false },
  { iso: 'RU', dial: '7', primary: true },
  { iso: 'DE', dial: '49', primary: true },
  { iso: 'RS', dial: '381', primary: true },
  { iso: 'KG', dial: '996', primary: true },
] as const;

describe('splitDialCode', () => {
  it('moves a typed dial code out of the number', () => {
    expect(splitDialCode('+996555123456', COUNTRIES)).toEqual({
      iso: 'KG',
      dial: '996',
      rest: '555123456',
    });
  });

  it('accepts the 00 international prefix', () => {
    expect(splitDialCode('0049 170 1234567', COUNTRIES)).toEqual({
      iso: 'DE',
      dial: '49',
      rest: '1701234567',
    });
  });

  it('ignores spaces, dashes and brackets around the digits', () => {
    expect(splitDialCode('+381 (11) 123-45-67', COUNTRIES)).toEqual({
      iso: 'RS',
      dial: '381',
      rest: '111234567',
    });
  });

  it('leaves a national number alone — no plus, no split', () => {
    expect(splitDialCode('0611234567', COUNTRIES)).toBeNull();
    expect(splitDialCode('381123456', COUNTRIES)).toBeNull();
  });

  it('returns an empty rest when only the code was typed', () => {
    expect(splitDialCode('+381', COUNTRIES)).toEqual({
      iso: 'RS',
      dial: '381',
      rest: '',
    });
  });

  it('picks the country that owns a shared code, not whichever sorts first', () => {
    expect(splitDialCode('+79161234567', COUNTRIES)?.iso).toBe('RU');
  });

  it('falls back to any match when none of the candidates is the owner', () => {
    const orphans = [
      { iso: 'KZ', dial: '7', primary: false },
      { iso: 'GB', dial: '44', primary: false },
    ];
    expect(splitDialCode('+79161234567', orphans)?.iso).toBe('KZ');
  });

  it('returns null for an unknown dial code', () => {
    expect(splitDialCode('+2995551234', COUNTRIES)).toBeNull();
  });

  it('returns null when the plus carries no digits at all', () => {
    expect(splitDialCode('+', COUNTRIES)).toBeNull();
    expect(splitDialCode('+ ()-', COUNTRIES)).toBeNull();
  });

  it('tolerates leading whitespace before the plus', () => {
    expect(splitDialCode('  +4917012345', COUNTRIES)?.iso).toBe('DE');
  });

  it('returns null against an empty country list', () => {
    expect(splitDialCode('+381123', [])).toBeNull();
  });

  it('never matches a placeholder option that carries no dial code', () => {
    const withPlaceholder = [
      { iso: '', dial: '' },
      { iso: 'DE', dial: '49', primary: true },
    ];

    expect(splitDialCode('+2995551234', withPlaceholder)).toBeNull();
    expect(splitDialCode('+4917012345', withPlaceholder)?.iso).toBe('DE');
  });
});
