import { describe, expect, it } from 'vitest';
import { pageWindow } from './pagination';

describe('pageWindow', () => {
  it('lists every page of a short listing', () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });

  it('keeps the ends and the neighbours of the current page, with a gap between', () => {
    expect(pageWindow(5, 9)).toEqual([1, 'gap', 4, 5, 6, 'gap', 9]);
  });

  it('opens no gap when only the neighbour is missing on one side', () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 'gap', 4]);
    expect(pageWindow(3, 4)).toEqual([1, 2, 3, 4]);
  });

  it('has the one page of a single-page listing', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});
