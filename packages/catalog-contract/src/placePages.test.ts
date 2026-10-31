import { describe, expect, it } from 'vitest';
import {
  makeHasPage,
  MIN_PARTS_FOR_PAGE,
  modelHasPage,
  vehicleHasPage,
} from './placePages.ts';

describe('which catalogue places get a page', () => {
  it('asks three distinct published Parts of a page', () => {
    expect(MIN_PARTS_FOR_PAGE).toBe(3);
  });

  it('gives a Model a page from three Parts fitted to its Vehicles', () => {
    expect(modelHasPage(3)).toBe(true);
    expect(modelHasPage(2)).toBe(false);
  });

  it('gives a Vehicle a page from three Parts, alone in its Model too', () => {
    expect(vehicleHasPage({ parts: 3, modelParts: 3 })).toBe(true);
    expect(vehicleHasPage({ parts: 2, modelParts: 4 })).toBe(false);
    expect(vehicleHasPage({ parts: 3, modelParts: 2 })).toBe(false);
  });

  it('gives a Make a page while one of its Models has one', () => {
    expect(makeHasPage(1)).toBe(true);
    expect(makeHasPage(0)).toBe(false);
  });
});
