import { describe, expect, it } from 'vitest';
import { coverScale, coverSizes } from './coverSizes';

describe('coverScale', () => {
  it('asks a wide photo cropped into a squarer box for the width the crop throws away', () => {
    expect(coverScale({ width: 1920, height: 1080 }, 4 / 3)).toBe(1.33);
  });

  it('asks a photo no wider than its box for its slot width', () => {
    expect(coverScale({ width: 1080, height: 1350 }, 4 / 3)).toBe(1);
    expect(coverScale({ width: 1920, height: 1080 }, 5 / 2)).toBe(1);
  });
});

describe('coverSizes', () => {
  it('scales every slot width, keeping its media condition', () => {
    expect(
      coverSizes('(min-width: 1224px) 368px, calc(33vw - 1.5rem), 78vw', 1.33),
    ).toBe(
      '(min-width: 1224px) calc(368px * 1.33), calc(calc(33vw - 1.5rem) * 1.33), calc(78vw * 1.33)',
    );
  });

  it('leaves the sizes alone when nothing is cropped away', () => {
    expect(coverSizes('(min-width: 1024px) 33vw, 100vw', 1)).toBe(
      '(min-width: 1024px) 33vw, 100vw',
    );
  });
});
