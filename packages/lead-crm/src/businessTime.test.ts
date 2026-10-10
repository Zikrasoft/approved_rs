import { describe, it, expect } from 'vitest';
import { businessDay } from './businessTime.ts';

describe('businessDay', () => {
  it.each([
    ['2026-10-15T21:59:00Z', 0, '2026-10-15'],
    ['2026-10-15T22:00:00Z', 0, '2026-10-16'],
    ['2026-10-15T23:59:00Z', 0, '2026-10-16'],
    ['2026-10-15T23:59:00Z', 1, '2026-10-17'],
    ['2026-01-15T23:30:00Z', 0, '2026-01-16'],
    ['2026-10-30T23:00:00Z', 1, '2026-11-01'],
    ['2026-10-24T23:00:00Z', 7, '2026-11-01'],
  ])('puts %s plus %d days on %s in Belgrade', (at, plus, day) => {
    expect(businessDay(new Date(at), plus)).toBe(day);
  });
});
