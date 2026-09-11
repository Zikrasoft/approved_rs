import { describe, it, expect } from 'vitest';
import { getVehicleImportCrossSellSpokes } from './vehicleImportCrossSell';

describe('getVehicleImportCrossSellSpokes', () => {
  it('rs matches the EU/China→Serbia corridor', () => {
    expect(getVehicleImportCrossSellSpokes('rs')).toEqual(['eu', 'china']);
  });

  it('es and pt both match the Germany/EU→Spain/Portugal corridor', () => {
    expect(getVehicleImportCrossSellSpokes('es')).toEqual(['de']);
    expect(getVehicleImportCrossSellSpokes('pt')).toEqual(['de']);
  });

  it('de matches the China→Germany corridor', () => {
    expect(getVehicleImportCrossSellSpokes('de')).toEqual(['china']);
  });

  it('returns an empty array for a country with no named corridor (e.g. Switzerland)', () => {
    expect(getVehicleImportCrossSellSpokes('ch')).toEqual([]);
  });

  it('returns an empty array for an unknown country code', () => {
    expect(getVehicleImportCrossSellSpokes('xx')).toEqual([]);
  });
});
