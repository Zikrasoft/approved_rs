import { describe, expect, it } from 'vitest';
import { VIN_INPUT_PATTERN, VIN_PATTERN } from './vin.ts';

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
