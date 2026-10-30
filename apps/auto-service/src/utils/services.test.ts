import { describe, expect, it } from 'vitest';
import { installationService } from './services';

describe('installationService', () => {
  it('books brake and suspension parts under brakes and suspension', () => {
    expect(installationService({ slug: 'brakes' })).toBe('brakes-suspension');
    expect(installationService({ slug: 'suspension' })).toBe(
      'brakes-suspension',
    );
  });

  it('books transmission parts under engine and gearbox', () => {
    expect(installationService({ slug: 'transmission' })).toBe(
      'engine-gearbox',
    );
  });

  it('books every other part, or one without a Category, under servicing', () => {
    expect(installationService({ slug: 'oil-filters' })).toBe('servicing');
    expect(installationService(null)).toBe('servicing');
  });
});
