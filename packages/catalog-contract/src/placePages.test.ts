import { describe, expect, it } from 'vitest';
import {
  makeHasPage,
  MIN_PARTS_FOR_PAGE,
  MIN_REQUIREMENT_MATCHES_FOR_PAGE,
  requirementMatchesCount,
  seriesCategoryHasPage,
  seriesHasPage,
} from './placePages.ts';

const place = (parts: number, required = 0) => ({ parts, required });

describe('which catalogue places get a page', () => {
  it('asks three distinct published Parts of a page, or two Requirement matches in one Category', () => {
    expect(MIN_PARTS_FOR_PAGE).toBe(3);
    expect(MIN_REQUIREMENT_MATCHES_FOR_PAGE).toBe(2);
  });

  it('counts Requirement matches only from two in one Category', () => {
    expect(requirementMatchesCount(1)).toBe(false);
    expect(requirementMatchesCount(2)).toBe(true);
  });

  it('gives a Series a page from three Parts, or from two Requirement matches in one Category', () => {
    expect(seriesHasPage(place(3))).toBe(true);
    expect(seriesHasPage(place(2))).toBe(false);
    expect(seriesHasPage(place(1, 1))).toBe(false);
    expect(seriesHasPage(place(2, 2))).toBe(true);
  });

  it('gives a Series category a page from three Parts', () => {
    expect(seriesCategoryHasPage(3)).toBe(true);
    expect(seriesCategoryHasPage(2)).toBe(false);
  });

  it('gives a Make a page while one of its Series has one', () => {
    expect(makeHasPage(1)).toBe(true);
    expect(makeHasPage(0)).toBe(false);
  });
});
