import { describe, expect, it } from 'vitest';
import { NOINDEX } from './robots.ts';

describe('NOINDEX', () => {
  it('keeps a page out of the index while its links are still followed', () => {
    expect(NOINDEX).toBe('noindex, follow');
  });
});
