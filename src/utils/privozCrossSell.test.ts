import { describe, it, expect } from 'vitest';
import { getPrivozCrossSellSpokes } from './privozCrossSell';

describe('getPrivozCrossSellSpokes', () => {
  it('rs matches the EU/China→Serbia corridor', () => {
    expect(getPrivozCrossSellSpokes('rs')).toEqual(['eu', 'china']);
  });

  it('es and pt both match the Germany/EU→Spain/Portugal corridor', () => {
    expect(getPrivozCrossSellSpokes('es')).toEqual(['de']);
    expect(getPrivozCrossSellSpokes('pt')).toEqual(['de']);
  });

  it('de matches the China→Germany corridor', () => {
    expect(getPrivozCrossSellSpokes('de')).toEqual(['china']);
  });

  it('returns an empty array for a country with no named corridor (e.g. Switzerland)', () => {
    expect(getPrivozCrossSellSpokes('ch')).toEqual([]);
  });

  it('returns an empty array for an unknown country code', () => {
    expect(getPrivozCrossSellSpokes('xx')).toEqual([]);
  });
});
