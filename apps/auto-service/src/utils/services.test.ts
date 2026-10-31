import { describe, expect, it } from 'vitest';
import { installationService, partsCategoryFor } from './services';

describe('installationService', () => {
  it.each([
    ['brakes', 'brakes-suspension'],
    ['brake-pads', 'brakes-suspension'],
    ['suspension', 'brakes-suspension'],
    ['engine-parts', 'engine-gearbox'],
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
    { slug: 'brakes', pages: [] },
    { slug: 'brake-pads', pages: [{}] },
    { slug: 'engine-oil', pages: [{}] },
  ];

  it('points a service at the first stocked Category its parts are fitted under', () => {
    expect(partsCategoryFor('brakes-suspension', categories)).toBe(
      'brake-pads',
    );
  });

  it('points nowhere when no stocked Category maps to the service', () => {
    expect(partsCategoryFor('engine-gearbox', categories)).toBeNull();
  });
});
