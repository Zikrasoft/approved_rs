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

  it('appends the note after the tail when it fits', () => {
    expect(
      fitComment({
        head: ['head'],
        lines: ['line 1'],
        tail: ['total'],
        note: ' call after six ',
        limit: 100,
        more,
      }),
    ).toBe('head\nline 1\ntotal\ncall after six');
  });

  it('keeps every part line and shortens a long note to fit', () => {
    const comment = fitComment({
      head: ['head'],
      lines: ['line 1', 'line 2'],
      tail: ['total'],
      note: 'n'.repeat(2000),
      limit: 40,
      more,
    });
    expect(comment).toBe(`head\nline 1\nline 2\ntotal\n${'n'.repeat(14)}…`);
    expect(comment).toHaveLength(40);
  });

  it('drops the note when the part lines leave no room for it', () => {
    expect(
      fitComment({
        head: ['head'],
        lines: ['line 1'],
        note: 'note',
        limit: 12,
        more,
      }),
    ).toBe('head\nline 1');
  });
});
