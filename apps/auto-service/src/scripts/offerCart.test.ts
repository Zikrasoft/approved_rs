import { describe, expect, it } from 'vitest';
import { stepTarget } from './offerCart';

describe('stepping a line quantity', () => {
  it('clamps a burst of taps past the cap to the cap and says so', () => {
    expect(stepTarget(1, 4, 3)).toEqual({ quantity: 3, capped: true });
    expect(stepTarget(1, 12, 10)).toEqual({ quantity: 10, capped: true });
  });

  it('steps freely below the cap and never under one', () => {
    expect(stepTarget(1, 1, 3)).toEqual({ quantity: 2, capped: false });
    expect(stepTarget(1, -1, 3)).toEqual({ quantity: 1, capped: false });
  });

  it('leaves the cap to the shop when it does not send one', () => {
    expect(stepTarget(1, 12, null)).toEqual({ quantity: 13, capped: false });
  });
});
