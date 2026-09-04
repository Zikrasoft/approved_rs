export type VehicleImportSpoke = 'de' | 'eu' | 'china' | 'es' | 'ch';

// Corridor-driven, not a blanket "also see vehicle-import" everywhere — only these
// country/vehicle-import-spoke pairs match a real corridor the business actually
// runs (EU/China→Serbia, Germany/EU→Spain/Portugal, China→Germany).
const VEHICLE_IMPORT_CROSS_SELL: Record<string, VehicleImportSpoke[]> = {
  rs: ['eu', 'china'],
  es: ['de'],
  pt: ['de'],
  de: ['china'],
};

export function getVehicleImportCrossSellSpokes(
  countryCode: string,
): VehicleImportSpoke[] {
  return VEHICLE_IMPORT_CROSS_SELL[countryCode] ?? [];
}
