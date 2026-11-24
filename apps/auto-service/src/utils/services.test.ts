import { describe, expect, it } from 'vitest';
import { installationService, partsCategoryFor } from './services';

describe('installationService', () => {
  it.each([
    ['brakes', 'brakes-suspension'],
    ['brake-pads', 'brakes-suspension'],
    ['control-arms', 'brakes-suspension'],
    ['bushings', 'brakes-suspension'],
    ['tie-rods', 'brakes-suspension'],
    ['shock-absorbers', 'brakes-suspension'],
    ['timing-belts', 'engine-gearbox'],
    ['poly-v-belts', 'engine-gearbox'],
    ['transmission', 'engine-gearbox'],
    ['body-parts', 'bodywork-painting'],
    ['oil-filters', 'servicing'],
    ['engine-oil', 'servicing'],
    ['batteries', 'servicing'],
  ])('books a part in %s under %s', (slug, service) => {
    expect(installationService({ slug })).toBe(service);
  });

  it('books a part without a Category under servicing', () => {
    expect(installationService(null)).toBe('servicing');
  });
});

describe('partsCategoryFor', () => {
  const categories = [
    { slug: 'brakes', listed: 0 },
    { slug: 'brake-pads', listed: 4 },
    { slug: 'engine-oil', listed: 2 },
  ];

  it('points a service at the first stocked Category its parts are fitted under', () => {
    expect(partsCategoryFor('brakes-suspension', categories)).toBe(
      'brake-pads',
    );
  });

  it('points servicing at the stocked oil filters or engine oil', () => {
    expect(partsCategoryFor('servicing', categories)).toBe('engine-oil');
    expect(
      partsCategoryFor('servicing', [
        { slug: 'oil-filters', listed: 1 },
        ...categories,
      ]),
    ).toBe('oil-filters');
  });

  it('does not count a Category the shop sent no count for', () => {
    expect(
      partsCategoryFor('servicing', [{ slug: 'oil-filters', listed: null }]),
    ).toBeNull();
  });

  it('points nowhere when no stocked Category maps to the service', () => {
    expect(partsCategoryFor('engine-gearbox', categories)).toBeNull();
  });
});
