import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { CASE_DIRS } from './translate-cases';

describe('case directory registry', () => {
  it.each(CASE_DIRS)('%s exists', (dir) => {
    expect(existsSync(dir)).toBe(true);
  });
});
