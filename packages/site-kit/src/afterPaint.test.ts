// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterNextPaint } from './afterPaint.ts';

beforeEach(() =>
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'],
  }),
);
afterEach(() => vi.useRealTimers());

describe('afterNextPaint', () => {
  it('runs once the next frame has painted, when layout is clean to read', () => {
    const run = vi.fn();
    afterNextPaint(run);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersToNextFrame();
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledOnce();
  });
});
