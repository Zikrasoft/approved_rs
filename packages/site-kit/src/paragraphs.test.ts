import { describe, expect, it } from 'vitest';
import { paragraphs } from './paragraphs.ts';

describe('paragraphs', () => {
  it('splits text on blank lines and drops empty paragraphs', () => {
    expect(
      paragraphs('  First line\nstill first\n\n \n\nSecond  \n\n'),
    ).toEqual(['First line\nstill first', 'Second']);
  });

  it('reads blank text as no paragraphs', () => {
    expect(paragraphs(' \n\n ')).toEqual([]);
  });
});
