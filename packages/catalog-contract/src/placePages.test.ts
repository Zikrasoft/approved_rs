import { describe, expect, it } from 'vitest';
import {
  makeHasPage,
  MIN_PARTS_FOR_PAGE,
  MIN_REQUIREMENT_MATCHES_FOR_PAGE,
  modelCategoryHasPage,
  modelHasPage,
  requirementMatchesCount,
  vehicleHasPage,
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

  it('gives a Model a page from three Parts, or from two Requirement matches in one Category', () => {
    expect(modelHasPage(place(3))).toBe(true);
    expect(modelHasPage(place(2))).toBe(false);
    expect(modelHasPage(place(1, 1))).toBe(false);
    expect(modelHasPage(place(2, 2))).toBe(true);
  });

  it('gives a Vehicle a page by the same rule, alone in its Model too', () => {
    expect(vehicleHasPage({ vehicle: place(3), model: place(3) })).toBe(true);
    expect(vehicleHasPage({ vehicle: place(2), model: place(4) })).toBe(false);
    expect(vehicleHasPage({ vehicle: place(3), model: place(2) })).toBe(false);
    expect(vehicleHasPage({ vehicle: place(2, 2), model: place(2, 2) })).toBe(
      true,
    );
    expect(vehicleHasPage({ vehicle: place(1, 1), model: place(2, 2) })).toBe(
      false,
    );
  });

  it('gives a Model category a page from one fitted Part or two Requirement matches', () => {
    expect(modelCategoryHasPage({ fitted: 1, required: 0 })).toBe(true);
    expect(modelCategoryHasPage({ fitted: 0, required: 1 })).toBe(false);
    expect(modelCategoryHasPage({ fitted: 0, required: 2 })).toBe(true);
  });

  it('gives a Make a page while one of its Models has one', () => {
    expect(makeHasPage(1)).toBe(true);
    expect(makeHasPage(0)).toBe(false);
  });
});
