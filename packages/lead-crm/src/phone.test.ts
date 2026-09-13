import { describe, it, expect } from 'vitest';
import { composeE164, isValidContact } from './phone.ts';

describe('composeE164', () => {
  it('produces a number the server accepts when the phone parser never loads', () => {
    const cases: [string, string][] = [
      ['60 123 4567', '381'],
      ['060 123 4567', '381'],
      ['+49 151 2345678', '381'],
      ['0049 151 2345678', '381'],
      ['912 345 678', '34'],
    ];
    cases.forEach(([typed, dial]) => {
      expect(isValidContact(composeE164(typed, dial), 'phone'), typed).toBe(
        true,
      );
    });
  });

  it('keeps the typed country when the number is already international', () => {
    expect(composeE164('+49 151 2345678', '381')).toBe('+491512345678');
    expect(composeE164('0049 151 2345678', '381')).toBe('+491512345678');
  });

  it('drops the national trunk zero before the dial code', () => {
    expect(composeE164('060 123 4567', '381')).toBe('+381601234567');
  });

  it('prefixes the selected dial code for a plain national number', () => {
    expect(composeE164('60 123 4567', '381')).toBe('+381601234567');
  });
});
