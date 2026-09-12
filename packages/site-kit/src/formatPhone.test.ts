import { describe, it, expect } from 'vitest';
import { formatPhone } from './formatPhone.ts';

describe('formatPhone', () => {
  it('groups a Serbian mobile number', () => {
    expect(formatPhone('381600000000')).toBe('+381 60 000 0000');
  });

  it('strips separators before grouping', () => {
    expect(formatPhone('+381 (60) 123-4567')).toBe('+381 60 123 4567');
  });

  it('leaves a too-short number ungrouped rather than slicing it into nonsense', () => {
    expect(formatPhone('12345678')).toBe('+12345678');
  });

  it('handles an empty string', () => {
    expect(formatPhone('')).toBe('+');
  });

  it('keeps every digit of a longer number in the last group', () => {
    expect(formatPhone('3811100000001')).toBe('+381 11 000 00001');
  });
});
