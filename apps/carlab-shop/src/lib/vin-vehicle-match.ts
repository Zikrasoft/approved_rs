import type { VinDecodeResult } from './vin-decoder';

export interface VinMatchableVehicle {
  id: string;
  make: string;
  year_from: number | null;
  year_to: number | null;
}

// TODO: the stub decoder only resolves make + a candidate year, never engine
// code, so a tie between same-make/same-year vehicles picks the first match
// deterministically. A real decode vendor (#325) with engine-code resolution
// removes this.
export function matchVehicleForVin<T extends VinMatchableVehicle>(
  decode: VinDecodeResult,
  vehicles: T[],
): T | null {
  if (!decode.manufacturer || decode.bestYearCandidate === null) return null;

  const manufacturer = decode.manufacturer.toLowerCase();
  const year = decode.bestYearCandidate;

  return (
    vehicles.find(
      (vehicle) =>
        vehicle.make.toLowerCase() === manufacturer &&
        (vehicle.year_from === null || vehicle.year_from <= year) &&
        (vehicle.year_to === null || vehicle.year_to >= year),
    ) ?? null
  );
}
