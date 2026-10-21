import { describe, expect, it } from 'vitest';
import { fitComment } from './comment.ts';

const more = (count: number) => `+${count}`;

describe('fitComment', () => {
  it('joins the head, every line and the tail when they fit', () => {
    expect(
      fitComment({
        head: ['BMW F30', ''],
        lines: ['a', 'b'],
        tail: ['total', ' '],
        limit: 100,
        more,
      }),
    ).toBe('BMW F30\na\nb\ntotal');
  });

  it('leaves lines out from the end and counts them, keeping head and tail', () => {
    expect(
      fitComment({
        head: ['head'],
        lines: ['line 1', 'line 2', 'line 3'],
        tail: ['tail'],
        limit: 22,
        more,
      }),
    ).toBe('head\nline 1\n+2\ntail');
  });

  it('cuts at the limit when head and tail alone are too long', () => {
    expect(
      fitComment({
        head: ['x'.repeat(10)],
        lines: ['line'],
        tail: [],
        limit: 5,
        more,
      }),
    ).toBe('xxxxx');
  });
});
