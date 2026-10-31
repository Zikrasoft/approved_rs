import { describe, expect, it } from 'vitest';
import { installationService } from './services';

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
