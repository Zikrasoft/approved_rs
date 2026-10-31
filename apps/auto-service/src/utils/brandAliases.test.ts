import { describe, expect, it } from 'vitest';
import { latinBrands } from './brandAliases';

describe('latinBrands', () => {
  it('spells Cyrillic brand names in Latin, whatever their case', () => {
    expect(latinBrands('Варта 580')).toBe('varta 580');
    expect(latinBrands('МАНН фильтр')).toBe('mann фильтр');
    expect(latinBrands('бош')).toBe('bosch');
  });

  it('leaves other words alone', () => {
    expect(latinBrands('задние колодки')).toBe('задние колодки');
    expect(latinBrands('HU 816 x')).toBe('HU 816 x');
  });
});
