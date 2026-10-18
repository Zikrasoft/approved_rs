import {
  matchVehicleForVin,
  type VinMatchableVehicle,
} from '../vin-vehicle-match';
import type { VinDecodeResult } from '../vin-decoder';

const decode = (overrides: Partial<VinDecodeResult> = {}): VinDecodeResult => ({
  wmi: 'WBA',
  manufacturer: 'BMW',
  plantCode: 'L',
  yearCandidates: [2016],
  bestYearCandidate: 2016,
  ...overrides,
});

const vehicle = (
  overrides: Partial<VinMatchableVehicle> = {},
): VinMatchableVehicle => ({
  id: 'vehicle_b47',
  make: 'BMW',
  year_from: 2015,
  year_to: 2018,
  ...overrides,
});

describe('matchVehicleForVin', () => {
  it('matches a vehicle whose make and year range cover the decoded year', () => {
    const b47 = vehicle();
    const n47 = vehicle({ id: 'vehicle_n47', year_from: 2010, year_to: 2012 });

    expect(matchVehicleForVin(decode(), [n47, b47])).toBe(b47);
  });

  it('matches make case-insensitively', () => {
    const bmw = vehicle({ make: 'bmw' });

    expect(matchVehicleForVin(decode(), [bmw])).toBe(bmw);
  });

  it('treats a null year bound as open-ended', () => {
    const openEnded = vehicle({ year_from: 2015, year_to: null });

    expect(
      matchVehicleForVin(decode({ bestYearCandidate: 2030 }), [openEnded]),
    ).toBe(openEnded);
  });

  it('returns null when no vehicle of that make covers the year', () => {
    const tooOld = vehicle({ year_from: 2010, year_to: 2012 });

    expect(matchVehicleForVin(decode(), [tooOld])).toBeNull();
  });

  it('returns null when the manufacturer is unknown', () => {
    expect(
      matchVehicleForVin(decode({ manufacturer: null }), [vehicle()]),
    ).toBeNull();
  });

  it('returns null when no year candidate could be resolved', () => {
    expect(
      matchVehicleForVin(decode({ bestYearCandidate: null }), [vehicle()]),
    ).toBeNull();
  });

  it('picks the first match deterministically when two vehicles tie', () => {
    const b47 = vehicle({ id: 'vehicle_b47', year_to: 2018 });
    const b48 = vehicle({ id: 'vehicle_b48', year_from: 2018, year_to: 2021 });

    expect(
      matchVehicleForVin(decode({ bestYearCandidate: 2018 }), [b47, b48]),
    ).toBe(b47);
  });
});
