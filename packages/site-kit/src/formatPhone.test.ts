import { describe, it, expect } from 'vitest';
import { formatPhone } from './formatPhone.ts';

describe('formatPhone', () => {
  it('groups the E.164 digits the way the country writes them', () => {
    expect(formatPhone('381677210533')).toBe('+381 67 7210533');
  });

  it('falls back to the plain number when no country claims it', () => {
    expect(formatPhone('99900')).toBe('+99900');
  });
});
