import { describe, expect, it } from 'vitest';
import { MAKES, makeDrift, makeName } from './makes';

const exported = [
  { slug: 'bmw', name: 'BMW' },
  { slug: 'skoda', name: 'Škoda' },
  { slug: 'seat', name: 'SEAT' },
];

describe('the exported Make list', () => {
  it('holds the catalogue Makes the Works are tied to', () => {
    expect(MAKES).toContainEqual({ slug: 'bmw', name: 'BMW' });
    expect(MAKES).toContainEqual({ slug: 'volkswagen', name: 'Volkswagen' });
  });

  it('names a Make by its slug', () => {
    expect(makeName('mercedes-benz')).toBe('Mercedes-Benz');
  });
});

describe('makeDrift', () => {
  it('finds nothing when every catalogue Make is in the list', () => {
    expect(
      makeDrift(
        [
          { slug: 'bmw', name: 'BMW' },
          { slug: 'bmw', name: 'BMW' },
          { slug: 'seat', name: 'SEAT' },
        ],
        exported,
      ),
    ).toEqual([]);
  });

  it('names a catalogue Make the list lacks', () => {
    expect(makeDrift([{ slug: 'mini', name: 'MINI' }], exported)).toEqual([
      'Make mini (MINI) is in the catalogue but not in src/content/makes.json',
    ]);
  });

  it('names a Make the list holds under another slug', () => {
    expect(makeDrift([{ slug: 'skoda-2', name: 'ŠKODA' }], exported)).toEqual([
      'Make Škoda is skoda-2 in the catalogue but skoda in src/content/makes.json',
    ]);
  });
});
