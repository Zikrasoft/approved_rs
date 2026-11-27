import { describe, it, expect } from 'vitest';
import { PHOTO_FORMATS, PHOTO_QUALITY } from './photo';

describe('photo defaults', () => {
  it('serves AVIF with a WebP fallback', () => {
    expect(PHOTO_FORMATS).toEqual(['avif', 'webp']);
  });

  it('keeps quality in the tuned 60-65 band', () => {
    expect(PHOTO_QUALITY).toBeGreaterThanOrEqual(60);
    expect(PHOTO_QUALITY).toBeLessThanOrEqual(65);
  });
});
