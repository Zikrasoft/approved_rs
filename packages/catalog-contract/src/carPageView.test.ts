import { describe, expect, it } from 'vitest';
import { carMakePagePath, carMakePageResponseSchema } from './carPageView.ts';

describe('the Car Make page contract', () => {
  it('addresses one Make under the catalogue pages', () => {
    expect(carMakePagePath('land rover')).toBe(
      '/store/catalogue-pages/cars/land%20rover',
    );
  });

  it('reads a shop that has not shipped the fields yet', () => {
    expect(carMakePageResponseSchema.parse({ extra: 1 })).toEqual({
      hub: false,
      categories: [],
      showcase: [],
    });
  });
});
