import { describe, expect, it } from 'vitest';
import { MAKES, makeName } from './makes';

describe('the catalogue Make list', () => {
  it('holds the catalogue Makes the Works are tied to', () => {
    expect(MAKES).toContainEqual(expect.objectContaining({ slug: 'bmw' }));
    expect(MAKES).toContainEqual(
      expect.objectContaining({ slug: 'volkswagen', name: 'Volkswagen' }),
    );
  });

  it('names a Make by its slug', () => {
    expect(makeName('mercedes-benz')).toBe('Mercedes-Benz');
  });
});
