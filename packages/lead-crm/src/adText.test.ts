import { describe, expect, it } from 'vitest';
import { cleanAdText } from './adText.ts';

describe('cleanAdText', () => {
  it('strips the characters an ad label may not carry, then trims and caps', () => {
    expect(cleanAdText(' Spring <b>sale</b> 🚗 | RS ')).toBe(
      'Spring bsale/b  | RS',
    );
    expect(cleanAdText(`a${'x'.repeat(120)}`)).toHaveLength(100);
  });

  it('is undefined when nothing is left', () => {
    expect(cleanAdText('<>')).toBeUndefined();
    expect(cleanAdText(null)).toBeUndefined();
    expect(cleanAdText(undefined)).toBeUndefined();
  });
});
